// ============================================================
// services/inventory-service/src/inventory.service.ts
// ============================================================
// Stock management:
// - quantity: total physical stock in warehouse
// - reserved: held for pending/confirmed orders
// - available = quantity - reserved (what can be added to cart)
//
// Redis is used for:
// - Fast availability checks (stock:available:{variantId})
// - Atomic decrements during flash sales
// - Low-stock pub/sub alerts
//
// PostgreSQL is the source of truth.
// Redis is always warmed from PostgreSQL on startup.
// ============================================================
import {
  Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index, OneToMany, ManyToOne, JoinColumn, CreateDateColumn
} from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BazarKafkaClient, KAFKA_TOPICS } from '@bazarbd/kafka-client';
import { BaseEvent, OrderStatus } from '@bazarbd/types';
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Entities ──────────────────────────────────────────────

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'variant_id', unique: true }) @Index() variantId: string;
  @Column({ type: 'int', default: 0 }) quantity: number;
  @Column({ type: 'int', default: 0 }) reserved: number;
  @Column({ name: 'low_stock_threshold', type: 'int', default: 10 }) lowStockThreshold: number;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  get available(): number { return Math.max(0, this.quantity - this.reserved); }
}

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'variant_id' }) @Index() variantId: string;
  @Column() type: string;
  @Column({ name: 'quantity_delta', type: 'int' }) quantityDelta: number;
  @Column({ name: 'reference_id', nullable: true }) referenceId: string;
  @Column({ nullable: true }) note: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── DTOs ──────────────────────────────────────────────────

export class RestockDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class AdjustStockDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty({ description: 'Positive = add, negative = subtract' }) @IsNumber() quantityDelta: number;
  @ApiProperty() @IsString() reason: string;
}

export class ReserveStockDto {
  items: Array<{ variantId: string; quantity: number }>;
  orderId: string;
}

// ── Service ────────────────────────────────────────────────

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

  // ── Warm Redis from PostgreSQL on startup ─────────────────
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

  // ── Subscribe to Kafka order events ───────────────────────
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

  // ──────────────────────────────────────────
  // RESERVE STOCK (SAGA step 1)
  // Called when order.created event received
  // ──────────────────────────────────────────
  private async reserveForOrder(payload: {
    orderId: string;
    items: Array<{ variantId: string; quantity: number }>;
  }, correlationId: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    const reserved: Array<{ variantId: string; quantity: number }> = [];

    try {
      for (const item of payload.items) {
        const result = await qr.manager.query(
          `UPDATE inventory
           SET reserved = reserved + $1
           WHERE variant_id = $2
             AND (quantity - reserved) >= $1
           RETURNING variant_id, quantity, reserved`,
          [item.quantity, item.variantId],
        );

        if (!result.length) {
          throw new Error(`Insufficient stock for variant ${item.variantId}`);
        }

        reserved.push(item);

        // Log transaction
        await qr.manager.save(InventoryTransaction, {
          variantId: item.variantId,
          type: 'reservation',
          quantityDelta: -item.quantity,
          referenceId: payload.orderId,
          note: `Reserved for order ${payload.orderId}`,
        } as InventoryTransaction);
      }

      await qr.commitTransaction();

      // Sync Redis
      for (const item of reserved) {
        await this.redis.decrby(`stock:available:${item.variantId}`, item.quantity);
      }

      this.logger.log(`Stock reserved for order ${payload.orderId}: ${reserved.length} variants`);
    } catch (err) {
      await qr.rollbackTransaction();

      // SAGA compensation: publish failure so Order Service cancels the order
      await this.kafka.publish(
        KAFKA_TOPICS.INVENTORY_EVENTS,
        'inventory.reservation_failed',
        { orderId: payload.orderId, reason: (err as Error).message },
        { correlationId },
      );

      this.logger.error(`Reservation failed for order ${payload.orderId}: ${(err as Error).message}`);
    } finally {
      await qr.release();
    }
  }

  // ──────────────────────────────────────────
  // HANDLE ORDER STATUS CHANGES
  // ──────────────────────────────────────────
  private async handleStatusChange(payload: {
    orderId: string;
    newStatus: OrderStatus;
  }): Promise<void> {
    const { orderId, newStatus } = payload;

    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.RETURN_REQUESTED) {
      // Release reserved stock back to available
      const rows = await this.dataSource.query(
        `UPDATE inventory i
         SET reserved = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi
         WHERE oi.order_id = $1
           AND i.variant_id = oi.variant_id
         RETURNING i.variant_id, oi.quantity`,
        [orderId],
      );

      for (const row of rows) {
        await this.redis.incrby(`stock:available:${row.variant_id}`, Number(row.quantity));

        await this.txRepo.save(this.txRepo.create({
          variantId: row.variant_id,
          type: 'release',
          quantityDelta: row.quantity,
          referenceId: orderId,
          note: `Released for ${newStatus} order ${orderId}`,
        }));
      }
      this.logger.log(`Stock released for ${newStatus} order ${orderId}`);
    }

    if (newStatus === OrderStatus.DELIVERED) {
      // Permanently deduct: move from reserved → actually sold
      const rows = await this.dataSource.query(
        `UPDATE inventory i
         SET quantity = quantity - oi.quantity,
             reserved = GREATEST(0, reserved - oi.quantity)
         FROM order_items oi
         WHERE oi.order_id = $1
           AND i.variant_id = oi.variant_id
         RETURNING i.variant_id, i.quantity, i.low_stock_threshold, oi.quantity as sold`,
        [orderId],
      );

      for (const row of rows) {
        await this.txRepo.save(this.txRepo.create({
          variantId: row.variant_id,
          type: 'sale',
          quantityDelta: -row.sold,
          referenceId: orderId,
          note: `Sold via order ${orderId}`,
        }));

        // Sync Redis actual quantity
        await this.redis.set(`stock:quantity:${row.variant_id}`, row.quantity);

        // Alert if below threshold
        if (row.quantity <= row.low_stock_threshold) {
          await this.kafka.publish(KAFKA_TOPICS.INVENTORY_EVENTS, 'inventory.low_stock', {
            variantId: row.variant_id,
            remaining: row.quantity,
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

  // ──────────────────────────────────────────
  // PUBLIC API METHODS
  // ──────────────────────────────────────────
  async getStock(variantId: string): Promise<{ variantId: string; quantity: number; reserved: number; available: number }> {
    const inv = await this.inventoryRepo.findOne({ where: { variantId } });
    if (!inv) throw new NotFoundException(`Inventory for variant ${variantId} not found`);
    return {
      variantId: inv.variantId,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: Math.max(0, inv.quantity - inv.reserved),
    };
  }

  async getBulkStock(variantIds: string[]): Promise<Record<string, number>> {
    // Batch Redis lookup
    const keys = variantIds.map((id) => `stock:available:${id}`);
    const values = await this.redis.mget(...keys);

    const result: Record<string, number> = {};
    variantIds.forEach((id, i) => {
      result[id] = parseInt(values[i] ?? '0') || 0;
    });
    return result;
  }

  async restock(dto: RestockDto): Promise<Inventory> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    try {
      let inv = await qr.manager.findOne(Inventory, { where: { variantId: dto.variantId } });
      if (!inv) {
        inv = qr.manager.create(Inventory, { variantId: dto.variantId, quantity: 0, reserved: 0 });
      }

      inv.quantity += dto.quantity;
      const saved = await qr.manager.save(inv);

      await qr.manager.save(InventoryTransaction, qr.manager.create(InventoryTransaction, {
        variantId: dto.variantId,
        type: 'restock',
        quantityDelta: dto.quantity,
        note: dto.note ?? 'Manual restock',
      }));

      await qr.commitTransaction();

      // Sync Redis
      await this.redis.incrby(`stock:available:${dto.variantId}`, dto.quantity);
      await this.redis.set(`stock:quantity:${dto.variantId}`, saved.quantity);

      this.logger.log(`Restocked ${dto.quantity} units for variant ${dto.variantId}`);
      return saved;
    } catch (err) {
      await qr.rollbackTransaction(); throw err;
    } finally {
      await qr.release();
    }
  }

  async adjustStock(dto: AdjustStockDto): Promise<Inventory> {
    const inv = await this.inventoryRepo.findOne({ where: { variantId: dto.variantId } });
    if (!inv) throw new NotFoundException(`Inventory for variant ${dto.variantId} not found`);

    const newQuantity = inv.quantity + dto.quantityDelta;
    if (newQuantity < 0) throw new BadRequestException('Adjustment would result in negative stock');

    inv.quantity = newQuantity;
    const saved = await this.inventoryRepo.save(inv);

    await this.txRepo.save(this.txRepo.create({
      variantId: dto.variantId,
      type: 'adjustment',
      quantityDelta: dto.quantityDelta,
      note: dto.reason,
    }));

    await this.redis.incrby(`stock:available:${dto.variantId}`, dto.quantityDelta);
    return saved;
  }

  async getLowStockItems(threshold?: number): Promise<Inventory[]> {
    return this.dataSource.query(
      `SELECT * FROM inventory
       WHERE quantity <= COALESCE($1, low_stock_threshold)
       ORDER BY quantity ASC
       LIMIT 100`,
      [threshold ?? null],
    );
  }
}

// ── Controller ─────────────────────────────────────────────

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':variantId')
  @ApiOperation({ summary: 'Get stock level for a variant' })
  getStock(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventoryService.getStock(variantId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Get stock levels for multiple variants' })
  getBulkStock(@Body() body: { variantIds: string[] }) {
    return this.inventoryService.getBulkStock(body.variantIds);
  }

  @Post('restock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add stock for a variant (seller / admin)' })
  restock(@Body() dto: RestockDto) {
    return this.inventoryService.restock(dto);
  }

  @Post('adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manual stock adjustment (admin only)' })
  adjust(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('alerts/low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get low-stock items' })
  getLowStock(@Query('threshold') threshold?: number) {
    return this.inventoryService.getLowStockItems(threshold);
  }
}

// Imports needed by controller
import { JwtAuthGuard, RolesGuard, Roles } from '@bazarbd/common';
import { UserRole } from '@bazarbd/types';