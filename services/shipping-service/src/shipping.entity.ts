// ============================================================
// services/shipping-service/src/shipping.entity.ts
// ============================================================
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { ShipmentStatus, ShippingCarrier } from '@bazarbd/types';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) @Index() orderId: string;
  @Column({ type: 'enum', enum: ShippingCarrier }) carrier: ShippingCarrier;
  @Column({ name: 'tracking_number', nullable: true }) @Index() trackingNumber: string;
  @Column({ name: 'carrier_order_id', nullable: true }) carrierOrderId: string;
  @Column({ name: 'label_url', nullable: true }) labelUrl: string;
  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.LABEL_CREATED }) status: ShipmentStatus;
  @Column({ name: 'estimated_delivery', nullable: true }) estimatedDelivery: Date;
  @Column({ name: 'delivered_at', nullable: true }) deliveredAt: Date;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => ShipmentTracking, (t) => t.shipment, { cascade: true }) trackingHistory: ShipmentTracking[];
}

@Entity('shipment_tracking')
export class ShipmentTracking {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shipment_id' }) @Index() shipmentId: string;
  @Column() status: string;
  @Column({ nullable: true }) location: string;
  @Column({ nullable: true }) description: string;
  @Column({ name: 'carrier_timestamp', nullable: true }) carrierTimestamp: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Shipment, (s) => s.trackingHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipment_id' }) shipment: Shipment;
}

// ============================================================
// services/shipping-service/src/carriers/pathao.carrier.ts
// Pathao Courier API
// Docs: https://docs.pathao.com/courier
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ShippingCarrier } from '@bazarbd/types';

export interface ShippingRate {
  carrier: ShippingCarrier;
  serviceType: string;
  price: number;
  estimatedDays: number;
  currency: string;
}

export interface CreateShipmentResult {
  trackingNumber: string;
  carrierOrderId: string;
  labelUrl?: string;
  estimatedDelivery?: Date;
}

@Injectable()
export class PathaoCarrier {
  private readonly logger = new Logger(PathaoCarrier.name);
  private readonly TOKEN_KEY = 'pathao:access_token';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get baseUrl() { return this.config.get<string>('pathao.baseUrl')!; }

  private async getToken(): Promise<string> {
    const cached = await this.redis.get(this.TOKEN_KEY);
    if (cached) return cached;

    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}/aladdin/api/v1/issue-token`, {
        client_id: this.config.get('pathao.clientId'),
        client_secret: this.config.get('pathao.clientSecret'),
        username: this.config.get('pathao.username'),
        password: this.config.get('pathao.password'),
        grant_type: 'password',
      }),
    );

    const token = res.data.access_token;
    const expiresIn = (res.data.expires_in ?? 3600) - 60;
    await this.redis.setex(this.TOKEN_KEY, expiresIn, token);
    return token;
  }

  async getRates(params: {
    fromCity: number;
    toCity: number;
    toZone: number;
    weightKg: number;
    isCod: boolean;
    codAmount?: number;
  }): Promise<ShippingRate[]> {
    try {
      const token = await this.getToken();
      const res = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/aladdin/api/v1/merchant/price-plan`,
          {
            store_id: this.config.get('pathao.storeId'),
            item_type: 2, // parcel
            delivery_type: 48,
            item_weight: params.weightKg,
            recipient_city: params.toCity,
            recipient_zone: params.toZone,
            is_cod: params.isCod ? 1 : 0,
          },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        ),
      );

      return [{
        carrier: ShippingCarrier.PATHAO,
        serviceType: 'Standard Delivery',
        price: res.data.data?.price ?? 80,
        estimatedDays: 3,
        currency: 'BDT',
      }];
    } catch {
      // Return fallback rate if API fails
      return [{ carrier: ShippingCarrier.PATHAO, serviceType: 'Standard Delivery', price: 80, estimatedDays: 3, currency: 'BDT' }];
    }
  }

  async createOrder(params: {
    orderId: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientCity: number;
    recipientZone: number;
    weightKg: number;
    isCod: boolean;
    codAmount?: number;
    itemCount?: number;
    specialInstruction?: string;
  }): Promise<CreateShipmentResult> {
    const token = await this.getToken();

    const res = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/aladdin/api/v1/merchant/orders`,
        {
          store_id: this.config.get('pathao.storeId'),
          merchant_order_id: params.orderId.slice(0, 24),
          recipient_name: params.recipientName,
          recipient_phone: params.recipientPhone,
          recipient_address: params.recipientAddress,
          recipient_city: params.recipientCity,
          recipient_zone: params.recipientZone,
          delivery_type: 48,
          item_type: 2,
          item_quantity: params.itemCount ?? 1,
          item_weight: params.weightKg,
          amount_to_collect: params.isCod ? (params.codAmount ?? 0) : 0,
          special_instruction: params.specialInstruction,
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      ),
    );

    const data = res.data.data;
    return {
      trackingNumber: data.consignment_id,
      carrierOrderId: data.consignment_id,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 3600 * 1000),
    };
  }

  async trackOrder(trackingNumber: string): Promise<Array<{ status: string; location: string; timestamp: Date }>> {
    const token = await this.getToken();
    const res = await firstValueFrom(
      this.http.get(
        `${this.baseUrl}/aladdin/api/v1/merchant/orders/${trackingNumber}/tracking`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    return (res.data.data ?? []).map((t: any) => ({
      status: t.status_slug,
      location: t.location ?? '',
      timestamp: new Date(t.time),
    }));
  }
}

// ============================================================
// services/shipping-service/src/carriers/redx.carrier.ts
// RedX Courier API
// Docs: https://redx.com.bd/developer
// ============================================================
@Injectable()
export class RedxCarrier {
  private readonly logger = new Logger(RedxCarrier.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get headers() {
    return {
      'API-ACCESS-TOKEN': `Bearer ${this.config.get('redx.apiToken')}`,
      'Content-Type': 'application/json',
    };
  }

  private get baseUrl() { return this.config.get<string>('redx.baseUrl')!; }

  async getRates(weightKg: number, isCod: boolean): Promise<ShippingRate[]> {
    try {
      // RedX flat rates by weight tier
      const baseRate = weightKg <= 0.5 ? 60 : weightKg <= 1 ? 70 : 80 + Math.ceil(weightKg - 1) * 15;
      const codCharge = isCod ? 25 : 0;
      return [{
        carrier: ShippingCarrier.REDX,
        serviceType: 'Same-day / Next-day (Dhaka)',
        price: baseRate + codCharge,
        estimatedDays: 2,
        currency: 'BDT',
      }];
    } catch {
      return [{ carrier: ShippingCarrier.REDX, serviceType: 'Standard', price: 75, estimatedDays: 2, currency: 'BDT' }];
    }
  }

  async createParcel(params: {
    orderId: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientArea: string;
    weightKg: number;
    isCod: boolean;
    codAmount?: number;
    parcelDescription?: string;
  }): Promise<CreateShipmentResult> {
    const res = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/parcel`,
        {
          name: params.recipientName,
          phone: params.recipientPhone,
          address: params.recipientAddress,
          area: params.recipientArea,
          parcel_weight: Math.ceil(params.weightKg * 1000), // grams
          parcel_description: params.parcelDescription ?? 'BazarBD Order',
          cash_collection_amount: params.isCod ? params.codAmount ?? 0 : 0,
          merchant_invoice_id: params.orderId.slice(0, 20),
          is_closed_box: 0,
        },
        { headers: this.headers },
      ),
    );

    return {
      trackingNumber: res.data.trackingId ?? res.data.tracking_id,
      carrierOrderId: res.data.trackingId ?? res.data.tracking_id,
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 3600 * 1000),
    };
  }

  async trackParcel(trackingId: string): Promise<Array<{ status: string; location: string; timestamp: Date }>> {
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/parcel/track?tracking_id=${trackingId}`, { headers: this.headers }),
    );
    return (res.data.trackingEvents ?? []).map((e: any) => ({
      status: e.status,
      location: e.location ?? '',
      timestamp: new Date(e.created_at),
    }));
  }
}

// ============================================================
// services/shipping-service/src/carriers/paperfly.carrier.ts
// Paperfly Courier (best for Dhaka same-day)
// ============================================================
import * as https from 'https';

@Injectable()
export class PaperflyCarrier {
  private readonly logger = new Logger(PaperflyCarrier.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl() { return this.config.get<string>('paperfly.baseUrl')!; }

  private get authHeaders() {
    const credentials = Buffer.from(
      `${this.config.get('paperfly.username')}:${this.config.get('paperfly.password')}`,
    ).toString('base64');
    return { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' };
  }

  async getRates(district: string, weightKg: number, isCod: boolean): Promise<ShippingRate[]> {
    const isDhaka = district.toLowerCase().includes('dhaka');
    const baseRate = isDhaka ? (weightKg <= 1 ? 60 : 60 + Math.ceil(weightKg - 1) * 10) : 100;
    const codCharge = isCod ? 25 : 0;

    return [{
      carrier: ShippingCarrier.PAPERFLY,
      serviceType: isDhaka ? 'Same-day Delivery' : 'Standard Delivery',
      price: baseRate + codCharge,
      estimatedDays: isDhaka ? 1 : 3,
      currency: 'BDT',
    }];
  }

  async createShipment(params: {
    orderId: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientDistrict: string;
    weightKg: number;
    isCod: boolean;
    codAmount?: number;
    productDescription?: string;
  }): Promise<CreateShipmentResult> {
    const res = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/merchant/create-order`,
        {
          order_type: params.isCod ? 'cod' : 'prepaid',
          merchant_order_id: params.orderId.slice(0, 20),
          customer_name: params.recipientName,
          customer_phone: params.recipientPhone,
          customer_address: params.recipientAddress,
          customer_district: params.recipientDistrict,
          weight_kg: params.weightKg,
          cod_amount: params.isCod ? params.codAmount ?? 0 : 0,
          product_description: params.productDescription ?? 'BazarBD Order',
          number_of_items: 1,
        },
        { headers: this.authHeaders },
      ),
    );

    return {
      trackingNumber: res.data.tracking_id ?? res.data.trackingId,
      carrierOrderId: res.data.tracking_id ?? res.data.trackingId,
      estimatedDelivery: new Date(Date.now() + 1 * 24 * 3600 * 1000),
    };
  }

  async trackShipment(trackingId: string): Promise<Array<{ status: string; location: string; timestamp: Date }>> {
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/merchant/tracking/${trackingId}`, { headers: this.authHeaders }),
    );
    return (res.data.events ?? []).map((e: any) => ({
      status: e.status,
      location: e.hub ?? '',
      timestamp: new Date(e.timestamp),
    }));
  }
}

// ============================================================
// services/shipping-service/src/shipping.service.ts
// ============================================================
import {
  Injectable, NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ShipmentStatus, ShippingCarrier } from '@bazarbd/types';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    @InjectRepository(Shipment) private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(ShipmentTracking) private readonly trackingRepo: Repository<ShipmentTracking>,
    private readonly pathao: PathaoCarrier,
    private readonly redx: RedxCarrier,
    private readonly paperfly: PaperflyCarrier,
    private readonly eventEmitter: EventEmitter2,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────
  // CALCULATE RATES — queries all 3 carriers in parallel
  // ──────────────────────────────────────────
  async calculateRates(params: {
    district: string;
    weightKg?: number;
    isCod?: boolean;
    codAmount?: number;
  }): Promise<{ rates: ShippingRate[]; cheapest: ShippingRate }> {
    const weightKg = params.weightKg ?? 0.5;
    const isCod = params.isCod ?? false;

    // Query all carriers simultaneously
    const [pathaoRates, redxRates, paperflyRates] = await Promise.allSettled([
      this.pathao.getRates({ fromCity: 1, toCity: 1, toZone: 1, weightKg, isCod, codAmount: params.codAmount }),
      this.redx.getRates(weightKg, isCod),
      this.paperfly.getRates(params.district, weightKg, isCod),
    ]);

    const rates: ShippingRate[] = [
      ...(pathaoRates.status === 'fulfilled' ? pathaoRates.value : []),
      ...(redxRates.status === 'fulfilled' ? redxRates.value : []),
      ...(paperflyRates.status === 'fulfilled' ? paperflyRates.value : []),
    ].sort((a, b) => a.price - b.price);

    if (!rates.length) {
      return {
        rates: [{ carrier: ShippingCarrier.PATHAO, serviceType: 'Standard', price: 80, estimatedDays: 3, currency: 'BDT' }],
        cheapest: { carrier: ShippingCarrier.PATHAO, serviceType: 'Standard', price: 80, estimatedDays: 3, currency: 'BDT' },
      };
    }

    return { rates, cheapest: rates[0] };
  }

  // ──────────────────────────────────────────
  // CREATE SHIPMENT
  // ──────────────────────────────────────────
  async createShipment(params: {
    orderId: string;
    carrier: ShippingCarrier;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientDistrict: string;
    recipientArea?: string;
    pathaoCity?: number;
    pathaoZone?: number;
    weightKg?: number;
    isCod?: boolean;
    codAmount?: number;
  }): Promise<Shipment> {
    const weightKg = params.weightKg ?? 0.5;
    const isCod = params.isCod ?? false;

    let result: CreateShipmentResult;

    switch (params.carrier) {
      case ShippingCarrier.PATHAO:
        result = await this.pathao.createOrder({
          orderId: params.orderId,
          recipientName: params.recipientName,
          recipientPhone: params.recipientPhone,
          recipientAddress: params.recipientAddress,
          recipientCity: params.pathaoCity ?? 1,
          recipientZone: params.pathaoZone ?? 1,
          weightKg,
          isCod,
          codAmount: params.codAmount,
        });
        break;

      case ShippingCarrier.REDX:
        result = await this.redx.createParcel({
          orderId: params.orderId,
          recipientName: params.recipientName,
          recipientPhone: params.recipientPhone,
          recipientAddress: params.recipientAddress,
          recipientArea: params.recipientArea ?? params.recipientDistrict,
          weightKg,
          isCod,
          codAmount: params.codAmount,
        });
        break;

      case ShippingCarrier.PAPERFLY:
        result = await this.paperfly.createShipment({
          orderId: params.orderId,
          recipientName: params.recipientName,
          recipientPhone: params.recipientPhone,
          recipientAddress: params.recipientAddress,
          recipientDistrict: params.recipientDistrict,
          weightKg,
          isCod,
          codAmount: params.codAmount,
        });
        break;

      default:
        throw new BadRequestException(`Unsupported carrier: ${params.carrier}`);
    }

    const shipment = await this.shipmentRepo.save(
      this.shipmentRepo.create({
        orderId: params.orderId,
        carrier: params.carrier,
        trackingNumber: result.trackingNumber,
        carrierOrderId: result.carrierOrderId,
        status: ShipmentStatus.LABEL_CREATED,
        estimatedDelivery: result.estimatedDelivery,
        metadata: { weightKg, isCod, codAmount: params.codAmount },
      }),
    );

    // Add initial tracking entry
    await this.trackingRepo.save(
      this.trackingRepo.create({
        shipmentId: shipment.id,
        status: 'label_created',
        description: `Shipment created via ${params.carrier}`,
        carrierTimestamp: new Date(),
      }),
    );

    this.eventEmitter.emit('shipment.created', {
      shipmentId: shipment.id,
      orderId: params.orderId,
      carrier: params.carrier,
      trackingNumber: result.trackingNumber,
    });

    this.logger.log(`Shipment created: ${shipment.id} tracking: ${result.trackingNumber}`);
    return shipment;
  }

  // ──────────────────────────────────────────
  // TRACK SHIPMENT — syncs carrier status
  // ──────────────────────────────────────────
  async trackShipment(shipmentId: string): Promise<Shipment> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id: shipmentId },
      relations: ['trackingHistory'],
    });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} not found`);
    if (!shipment.trackingNumber) return shipment;

    let events: Array<{ status: string; location: string; timestamp: Date }> = [];

    try {
      switch (shipment.carrier) {
        case ShippingCarrier.PATHAO:
          events = await this.pathao.trackOrder(shipment.trackingNumber);
          break;
        case ShippingCarrier.REDX:
          events = await this.redx.trackParcel(shipment.trackingNumber);
          break;
        case ShippingCarrier.PAPERFLY:
          events = await this.paperfly.trackShipment(shipment.trackingNumber);
          break;
      }
    } catch (e) {
      this.logger.warn(`Tracking fetch failed for ${shipment.trackingNumber}: ${(e as Error).message}`);
      return shipment;
    }

    // Save new tracking events
    const existingStatuses = new Set(shipment.trackingHistory.map((t) => `${t.status}:${t.carrierTimestamp?.getTime()}`));

    for (const event of events) {
      const key = `${event.status}:${event.timestamp.getTime()}`;
      if (!existingStatuses.has(key)) {
        await this.trackingRepo.save(
          this.trackingRepo.create({
            shipmentId,
            status: event.status,
            location: event.location,
            carrierTimestamp: event.timestamp,
          }),
        );
      }
    }

    // Update shipment status based on latest event
    if (events.length > 0) {
      const latestStatus = events[events.length - 1].status.toLowerCase();
      let newStatus: ShipmentStatus | null = null;

      if (latestStatus.includes('picked') || latestStatus.includes('pickup')) newStatus = ShipmentStatus.PICKED_UP;
      else if (latestStatus.includes('transit') || latestStatus.includes('hub')) newStatus = ShipmentStatus.IN_TRANSIT;
      else if (latestStatus.includes('out_for') || latestStatus.includes('ofd')) newStatus = ShipmentStatus.OUT_FOR_DELIVERY;
      else if (latestStatus.includes('delivered')) newStatus = ShipmentStatus.DELIVERED;
      else if (latestStatus.includes('returned') || latestStatus.includes('return')) newStatus = ShipmentStatus.RETURNED;

      if (newStatus && newStatus !== shipment.status) {
        await this.shipmentRepo.update(shipmentId, {
          status: newStatus,
          ...(newStatus === ShipmentStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        });

        this.eventEmitter.emit('shipment.updated', {
          shipmentId,
          orderId: shipment.orderId,
          status: newStatus,
          trackingNumber: shipment.trackingNumber,
        });
      }
    }

    return this.shipmentRepo.findOne({ where: { id: shipmentId }, relations: ['trackingHistory'] }) as Promise<Shipment>;
  }

  // ──────────────────────────────────────────
  // GET BY ORDER
  // ──────────────────────────────────────────
  async findByOrder(orderId: string): Promise<Shipment[]> {
    return this.shipmentRepo.find({
      where: { orderId },
      relations: ['trackingHistory'],
      order: { createdAt: 'DESC' },
    });
  }
}

// ============================================================
// services/shipping-service/src/shipping.controller.ts
// ============================================================
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { Public } from './common/decorators/public.decorator';
import { UserRole } from '@bazarbd/types';
import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CalculateRatesDto {
  @ApiProperty() @IsString() district: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01) weightKg?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCod?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() codAmount?: number;
}

class CreateShipmentDto {
  @ApiProperty() orderId: string;
  @ApiProperty({ enum: ShippingCarrier }) @IsEnum(ShippingCarrier) carrier: ShippingCarrier;
  @ApiProperty() recipientName: string;
  @ApiProperty() recipientPhone: string;
  @ApiProperty() recipientAddress: string;
  @ApiProperty() recipientDistrict: string;
  @ApiPropertyOptional() @IsOptional() recipientArea?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pathaoCity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pathaoZone?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01) weightKg?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCod?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() codAmount?: number;
}

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ summary: 'Get shipping rates from all carriers' })
  calculateRates(@Body() dto: CalculateRatesDto) {
    return this.shippingService.calculateRates(dto);
  }

  @Post('shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create shipment (seller / admin)' })
  createShipment(@Body() dto: CreateShipmentDto) {
    return this.shippingService.createShipment(dto);
  }

  @Get('shipments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shipment with tracking history' })
  getShipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.shippingService.trackShipment(id);
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all shipments for an order' })
  getByOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.shippingService.findByOrder(orderId);
  }

  // Webhook from carriers (tracking updates pushed to us)
  @Post('webhooks/pathao')
  @Public()
  @ApiOperation({ summary: 'Pathao tracking webhook' })
  async pathaoWebhook(@Body() body: any) {
    const trackingNumber = body.consignment_id;
    if (!trackingNumber) return { status: 'ignored' };

    const shipment = await this.shippingService.findByTrackingNumber(trackingNumber);
    if (shipment) await this.shippingService.trackShipment(shipment.id);
    return { status: 'ok' };
  }

  @Post('webhooks/redx')
  @Public()
  @ApiOperation({ summary: 'RedX tracking webhook' })
  async redxWebhook(@Body() body: any) {
    const trackingNumber = body.tracking_id;
    if (!trackingNumber) return { status: 'ignored' };

    const shipment = await this.shippingService.findByTrackingNumber(trackingNumber);
    if (shipment) await this.shippingService.trackShipment(shipment.id);
    return { status: 'ok' };
  }
}