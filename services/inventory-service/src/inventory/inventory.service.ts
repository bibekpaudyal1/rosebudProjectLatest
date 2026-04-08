import {
  Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BazarKafkaClient, KAFKA_TOPICS } from '@bazarbd/kafka-client';
import { BaseEvent, OrderStatus } from '@bazarbd/types';
import { Inventory } from './entities/inventory.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { RestockDto, AdjustStockDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory) private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(InventoryTransaction) private readonly txRepo: Repository<InventoryTransaction>,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly kafka: BazarKafkaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.connectProducer();
    await this.warmRedisCache();
    await this.subscribeToOrderEvents();
  }

  private async warmRedisCache(): Promise<void> {
    this.logger.log('Warming inventory Redis cache...');
    const rows = await this.inventoryRepo.find();
    const pipeline = this.redis.pipeline();
    for (const row of rows) {
      const available = Math.max(0, row.quantity - row.reserved);
      pipeline.set(`stock:available:${row.variantId}`, available);
      pipeline.set(`stock:quantity:${row.variantId}`, row.quantity);
    }
    await pipeline.exec();
    this.logger.log(`Warmed Redis cache for ${rows.length} variants`);
  }

  private async subscribeToOrderEvents(): Promise<void> {
    await this.kafka.subscribe(
      [KAFKA_TOPICS.ORDER_EVENTS],
      this.handleOrderEvent.bind(this),
      'inventory-service',
    );
  }

  private async handleOrderEvent(event: BaseEvent): Promise<void> {
    switch (event.eventType) {
      case 'order.created':
        await this.reserveForOrder(event.payload as any, event.correlationId);
        break;
      case 'order.status_changed':
        await this.handleStatusChange(event.payload as any);
        break;
    }
  }

  // SAGA step 1: Reserve stock when order is created
  private async reserveForOrder(payload: {
    orderId: string; items: Array<{ variantId: string; quantity: number }>;
  }, correlationId: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    const reserved: Array<{ variantId: string; quantity: number }> = [];

    try {
      for (const item of payload.items) {
        const result = await qr.manager.query(
          `UPDATE inventory SET reserved = reserved + $1
           WHERE variant_id = $2 AND (quantity - reserved) >= $1
           RETURNING variant_id, quantity, reserved`,
          [item.quantity, item.variantId],
        );
        if (!result.length) throw new Error(`Insufficient stock for variant ${item.variantId}`);
        reserved.push(item);
        await qr.manager.save(InventoryTransaction, {
          variantId: item.variantId, type: 'reservation', quantityDelta: -item.quantity,
          referenceId: payload.orderId, note: `Reserved for order ${payload.orderId}`,
        } as InventoryTransaction);
      }
      await qr.commitTransaction();

      for (const item of reserved) {
        await this.redis.decrby(`stock:available:${item.variantId}`, item.quantity);
      }
      this.logger.log(`Stock reserved for order ${payload.orderId}: ${reserved.length} variants`);
    } catch (err) {
      await qr.rollbackTransaction();
      await this.kafka.publish(
        KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.reservation_failed',
        { orderId: payload.orderId, reason: (err as Error).message },
        { correlationId },
      );
      this.logger.error(`Reservation failed for order ${payload.orderId}: ${(err as Error).message}`);
    } finally {
      await qr.release();
    }
  }

  private async handleStatusChange(payload: { orderId: string; newStatus: OrderStatus }): Promise<void> {
    const { orderId, newStatus } = payload;

    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.RETURN_REQUESTED) {
      const rows = await this.dataSource.query(
        `UPDATE inventory i SET reserved = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi WHERE oi.order_id = $1 AND i.variant_id = oi.variant_id
         RETURNING i.variant_id, oi.quantity`,
        [orderId],
      );
      for (const row of rows) {
        await this.redis.incrby(`stock:available:${row.variant_id}`, Number(row.quantity));
        await this.txRepo.save(this.txRepo.create({
          variantId: row.variant_id, type: 'release', quantityDelta: row.quantity,
          referenceId: orderId, note: `Released for ${newStatus} order ${orderId}`,
        }));
      }
      this.logger.log(`Stock released for ${newStatus} order ${orderId}`);
    }

    if (newStatus === OrderStatus.DELIVERED) {
      const rows = await this.dataSource.query(
        `UPDATE inventory i SET quantity = quantity - oi.quantity,
             reserved = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi WHERE oi.order_id = $1 AND i.variant_id = oi.variant_id
         RETURNING i.variant_id, i.quantity, i.low_stock_threshold, oi.quantity as sold`,
        [orderId],
      );
      for (const row of rows) {
        await this.txRepo.save(this.txRepo.create({
          variantId: row.variant_id, type: 'sale', quantityDelta: -row.sold,
          referenceId: orderId, note: `Sold via order ${orderId}`,
        }));
        await this.redis.set(`stock:quantity:${row.variant_id}`, row.quantity);
        if (row.quantity <= row.low_stock_threshold) {
          await this.kafka.publish(KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.low_stock', {
            variantId: row.variant_id, remaining: row.quantity,
          });
        }
        if (row.quantity === 0) {
          await this.kafka.publish(KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.out_of_stock', {
            variantId: row.variant_id,
          });
        }
      }
    }
  }

  // Public API methods
  async getStock(variantId: string): Promise<{ variantId: string; quantity: number; reserved: number; available: number }> {
    const inv = await this.inventoryRepo.findOne({ where: { variantId } });
    if (!inv) throw new NotFoundException(`Inventory for variant ${variantId} not found`);
    return { variantId: inv.variantId, quantity: inv.quantity, reserved: inv.reserved, available: Math.max(0, inv.quantity - inv.reserved) };
  }

  async getBulkStock(variantIds: string[]): Promise<Record<string, number>> {
    const keys = variantIds.map((id) => `stock:available:${id}`);
    const values = await this.redis.mget(...keys);
    const result: Record<string, number> = {};
    variantIds.forEach((id, i) => { result[id] = parseInt(values[i] ?? '0') || 0; });
    return result;
  }

  async restock(dto: RestockDto): Promise<Inventory> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      let inv = await qr.manager.findOne(Inventory, { where: { variantId: dto.variantId } });
      if (!inv) inv = qr.manager.create(Inventory, { variantId: dto.variantId, quantity: 0, reserved: 0 });
      inv.quantity += dto.quantity;
      const saved = await qr.manager.save(inv);
      await qr.manager.save(InventoryTransaction, qr.manager.create(InventoryTransaction, {
        variantId: dto.variantId, type: 'restock', quantityDelta: dto.quantity, note: dto.note ?? 'Manual restock',
      }));
      await qr.commitTransaction();
      await this.redis.incrby(`stock:available:${dto.variantId}`, dto.quantity);
      await this.redis.set(`stock:quantity:${dto.variantId}`, saved.quantity);
      this.logger.log(`Restocked ${dto.quantity} units for variant ${dto.variantId}`);
      return saved;
    } catch (err) { await qr.rollbackTransaction(); throw err; }
    finally { await qr.release(); }
  }

  async adjustStock(dto: AdjustStockDto): Promise<Inventory> {
    const inv = await this.inventoryRepo.findOne({ where: { variantId: dto.variantId } });
    if (!inv) throw new NotFoundException(`Inventory for variant ${dto.variantId} not found`);
    const newQuantity = inv.quantity + dto.quantityDelta;
    if (newQuantity < 0) throw new BadRequestException('Adjustment would result in negative stock');
    inv.quantity = newQuantity;
    const saved = await this.inventoryRepo.save(inv);
    await this.txRepo.save(this.txRepo.create({
      variantId: dto.variantId, type: 'adjustment', quantityDelta: dto.quantityDelta, note: dto.reason,
    }));
    await this.redis.incrby(`stock:available:${dto.variantId}`, dto.quantityDelta);
    return saved;
  }

  async getLowStockItems(threshold?: number): Promise<Inventory[]> {
    return this.dataSource.query(
      `SELECT * FROM inventory WHERE quantity <= COALESCE($1, low_stock_threshold) ORDER BY quantity ASC LIMIT 100`,
      [threshold ?? null],
    );
  }
}
