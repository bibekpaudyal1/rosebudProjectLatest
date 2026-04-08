// ============================================================
// packages/kafka-listeners/src/index.ts
// ============================================================
// Shared Kafka event listener patterns.
// Each service copies the listeners it needs and
// wires them into its NestJS AppModule.
// ============================================================

// ── Inventory listener (in inventory-service) ──────────────
// Consumes: order.events → reserves / releases stock
// ============================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BazarKafkaClient, KAFKA_TOPICS } from '@bazarbd/kafka-client';
import { BaseEvent, OrderStatus } from '@bazarbd/types';

@Injectable()
export class InventoryKafkaListener implements OnModuleInit {
  private readonly logger = new Logger(InventoryKafkaListener.name);

  constructor(
    private readonly kafka: BazarKafkaClient,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.connectProducer();
    await this.kafka.subscribe(
      [KAFKA_TOPICS.ORDER_EVENTS],
      this.handleOrderEvent.bind(this),
      'inventory-service-order-consumer',
    );
  }

  private async handleOrderEvent(event: BaseEvent): Promise<void> {
    switch (event.eventType) {
      case 'order.created':
        await this.reserveStock(event);
        break;
      case 'order.status_changed':
        await this.handleStatusChange(event);
        break;
    }
  }

  private async reserveStock(event: BaseEvent): Promise<void> {
    const { items } = event.payload as {
      items: Array<{ variantId: string; quantity: number }>;
      orderId: string;
    };

    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    try {
      for (const item of items) {
        const result = await qr.manager.query(
          `UPDATE inventory
           SET reserved = reserved + $1
           WHERE variant_id = $2
             AND (quantity - reserved) >= $1
           RETURNING id, quantity, reserved`,
          [item.quantity, item.variantId],
        );
        if (!result.length) {
          throw new Error(`Insufficient stock for variant ${item.variantId}`);
        }
      }
      await qr.commitTransaction();
      this.logger.log(`Stock reserved for order ${(event.payload as any).orderId}`);
    } catch (err) {
      await qr.rollbackTransaction();
      // Publish compensation event so Order Service can cancel the order
      await this.kafka.publish(KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.reservation_failed', {
        orderId: (event.payload as any).orderId,
        reason: (err as Error).message,
      }, { correlationId: event.correlationId });
      this.logger.error(`Stock reservation failed: ${(err as Error).message}`);
    } finally {
      await qr.release();
    }
  }

  private async handleStatusChange(event: BaseEvent): Promise<void> {
    const { orderId, newStatus, previousStatus } = event.payload as {
      orderId: string; newStatus: OrderStatus; previousStatus: OrderStatus;
    };

    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.RETURN_REQUESTED) {
      // Release reserved stock
      await this.dataSource.query(
        `UPDATE inventory i
         SET reserved = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi
         WHERE oi.order_id = $1
           AND i.variant_id = oi.variant_id`,
        [orderId],
      );
      this.logger.log(`Stock released for ${newStatus} order ${orderId}`);
    }

    if (newStatus === OrderStatus.DELIVERED) {
      // Deduct from quantity (reservation fulfilled)
      await this.dataSource.query(
        `UPDATE inventory i
         SET quantity  = quantity - oi.quantity,
             reserved  = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi
         WHERE oi.order_id = $1
           AND i.variant_id = oi.variant_id`,
        [orderId],
      );
      // Check for low stock
      await this.checkLowStock(orderId);
    }
  }

  private async checkLowStock(orderId: string): Promise<void> {
    const lowStockItems = await this.dataSource.query(
      `SELECT i.variant_id, i.quantity, i.low_stock_threshold,
              p.id as product_id, p.seller_id
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN order_items oi ON oi.variant_id = i.variant_id AND oi.order_id = $1
       WHERE i.quantity <= i.low_stock_threshold`,
      [orderId],
    );

    for (const item of lowStockItems) {
      await this.kafka.publish(KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.low_stock', {
        variantId: item.variant_id,
        productId: item.product_id,
        sellerId: item.seller_id,
        remaining: item.quantity,
      });
    }
  }
}

// ── Notification listener (in notification-service) ────────
// Consumes: order.events, payment.events, user.events
// Sends SMS, email, and push notifications
// ============================================================

@Injectable()
export class NotificationKafkaListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationKafkaListener.name);

  constructor(
    private readonly kafka: BazarKafkaClient,
    private readonly notificationSender: any, // NotificationSenderService injected
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe(
      [KAFKA_TOPICS.ORDER_EVENTS, KAFKA_TOPICS.PAYMENT_EVENTS, KAFKA_TOPICS.USER_EVENTS, KAFKA_TOPICS.SHIPMENT_EVENTS],
      this.handleEvent.bind(this),
      'notification-service-consumer',
    );
  }

  private async handleEvent(event: BaseEvent): Promise<void> {
    this.logger.debug(`Notification event: ${event.eventType}`);

    switch (event.eventType) {
      case 'user.registered':
        await this.sendWelcome(event.payload as any);
        break;
      case 'order.created':
        await this.sendOrderConfirmation(event.payload as any);
        break;
      case 'order.status_changed':
        await this.sendOrderStatusUpdate(event.payload as any);
        break;
      case 'payment.completed':
        await this.sendPaymentSuccess(event.payload as any);
        break;
      case 'payment.failed':
        await this.sendPaymentFailed(event.payload as any);
        break;
      case 'shipment.updated':
        await this.sendShipmentUpdate(event.payload as any);
        break;
      case 'inventory.low_stock':
        await this.sendLowStockAlert(event.payload as any);
        break;
    }
  }

  private async sendWelcome(payload: { userId: string; phone?: string; fullName: string }): Promise<void> {
    if (payload.phone) {
      await this.notificationSender.sendSms(
        payload.phone,
        `Welcome to BazarBD, ${payload.fullName}! Start shopping at bazarbd.com`,
      );
    }
    await this.saveNotification(payload.userId, {
      title: 'Welcome to BazarBD!',
      body: `Hi ${payload.fullName}, your account is ready. Happy shopping!`,
      channel: 'in_app',
    });
  }

  private async sendOrderConfirmation(payload: {
    orderId: string; orderNumber: string; customerId: string; total: number; paymentMethod: string;
  }): Promise<void> {
    const user = await this.getUserPhone(payload.customerId);
    if (user?.phone) {
      const msg = payload.paymentMethod === 'cod'
        ? `Order ${payload.orderNumber} confirmed! Total: ৳${payload.total}. COD will be collected on delivery.`
        : `Order ${payload.orderNumber} placed! Please complete payment of ৳${payload.total}.`;
      await this.notificationSender.sendSms(user.phone, msg);
    }
    await this.saveNotification(payload.customerId, {
      title: `Order ${payload.orderNumber} placed`,
      body: `Your order for ৳${payload.total} has been placed successfully.`,
      channel: 'in_app',
      referenceType: 'order',
      referenceId: payload.orderId,
    });
  }

  private async sendOrderStatusUpdate(payload: {
    orderId: string; orderNumber: string; customerId: string; newStatus: string;
  }): Promise<void> {
    const statusMessages: Record<string, string> = {
      confirmed:         `Order ${payload.orderNumber} confirmed and being processed.`,
      packed:            `Order ${payload.orderNumber} is packed and ready to ship.`,
      shipped:           `Order ${payload.orderNumber} has been shipped.`,
      out_for_delivery:  `Order ${payload.orderNumber} is out for delivery today!`,
      delivered:         `Order ${payload.orderNumber} delivered! Please leave a review.`,
      cancelled:         `Order ${payload.orderNumber} has been cancelled.`,
      refunded:          `Refund for order ${payload.orderNumber} has been processed.`,
    };

    const msg = statusMessages[payload.newStatus];
    if (!msg) return;

    const user = await this.getUserPhone(payload.customerId);
    if (user?.phone) await this.notificationSender.sendSms(user.phone, msg);

    await this.saveNotification(payload.customerId, {
      title: `Order ${payload.newStatus.replace(/_/g, ' ')}`,
      body: msg,
      channel: 'in_app',
      referenceType: 'order',
      referenceId: payload.orderId,
    });
  }

  private async sendPaymentSuccess(payload: { orderId: string; amount: number; customerId?: string }): Promise<void> {
    if (!payload.customerId) return;
    await this.saveNotification(payload.customerId, {
      title: 'Payment successful',
      body: `Payment of ৳${payload.amount} received.`,
      channel: 'in_app',
      referenceType: 'payment',
      referenceId: payload.orderId,
    });
  }

  private async sendPaymentFailed(payload: { orderId: string; customerId?: string; reason?: string }): Promise<void> {
    if (!payload.customerId) return;
    const user = await this.getUserPhone(payload.customerId);
    if (user?.phone) {
      await this.notificationSender.sendSms(user.phone, `Payment failed for your order. Please retry or choose a different payment method.`);
    }
  }

  private async sendShipmentUpdate(payload: { orderId: string; status: string; trackingNumber?: string }): Promise<void> {
    this.logger.log(`Shipment update for order ${payload.orderId}: ${payload.status}`);
  }

  private async sendLowStockAlert(payload: { variantId: string; sellerId: string; remaining: number }): Promise<void> {
    await this.saveNotification(payload.sellerId, {
      title: 'Low stock alert',
      body: `A product variant is running low (${payload.remaining} remaining). Restock soon.`,
      channel: 'in_app',
      referenceType: 'product',
      referenceId: payload.variantId,
    });
  }

  private async saveNotification(userId: string, data: {
    title: string; body: string; channel: string;
    referenceType?: string; referenceId?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notifications (user_id, title, body, channel, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, data.title, data.body, data.channel, data.referenceType ?? null, data.referenceId ?? null],
    );
  }

  private async getUserPhone(userId: string): Promise<{ phone?: string } | null> {
    return this.dataSource.query(
      `SELECT phone FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    ).then((rows: any[]) => rows[0] ?? null);
  }
}

// ── Analytics listener (in analytics-service) ──────────────
// Consumes ALL topics and writes to analytics tables
// ============================================================

@Injectable()
export class AnalyticsKafkaListener implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsKafkaListener.name);

  constructor(
    private readonly kafka: BazarKafkaClient,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe(
      [
        KAFKA_TOPICS.ORDER_EVENTS,
        KAFKA_TOPICS.PAYMENT_EVENTS,
        KAFKA_TOPICS.USER_EVENTS,
        KAFKA_TOPICS.PRODUCT_EVENTS,
        KAFKA_TOPICS.SHIPMENT_EVENTS,
      ],
      this.handleEvent.bind(this),
      'analytics-service-consumer',
    );
  }

  private async handleEvent(event: BaseEvent): Promise<void> {
    // Write every event to the analytics raw events table
    await this.dataSource.query(
      `INSERT INTO analytics_events (event_id, event_type, source, correlation_id, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.source, event.correlationId, JSON.stringify(event.payload), new Date(event.timestamp)],
    ).catch((e: Error) => this.logger.error(`Analytics insert failed: ${e.message}`));

    // Materialised metric updates
    switch (event.eventType) {
      case 'order.created':
        await this.updateOrderMetrics(event.payload as any);
        break;
      case 'payment.completed':
        await this.updateRevenueMetrics(event.payload as any);
        break;
      case 'user.registered':
        await this.updateUserMetrics();
        break;
    }
  }

  private async updateOrderMetrics(payload: { orderId: string; total: number }): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.dataSource.query(
      `INSERT INTO daily_order_metrics (date, order_count, gmv)
       VALUES ($1, 1, $2)
       ON CONFLICT (date) DO UPDATE
       SET order_count = daily_order_metrics.order_count + 1,
           gmv = daily_order_metrics.gmv + EXCLUDED.gmv`,
      [today, payload.total],
    );
  }

  private async updateRevenueMetrics(payload: { amount: number }): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.dataSource.query(
      `INSERT INTO daily_revenue_metrics (date, revenue)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE
       SET revenue = daily_revenue_metrics.revenue + EXCLUDED.revenue`,
      [today, payload.amount],
    );
  }

  private async updateUserMetrics(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.dataSource.query(
      `INSERT INTO daily_user_metrics (date, new_registrations)
       VALUES ($1, 1)
       ON CONFLICT (date) DO UPDATE
       SET new_registrations = daily_user_metrics.new_registrations + 1`,
      [today],
    );
  }
}