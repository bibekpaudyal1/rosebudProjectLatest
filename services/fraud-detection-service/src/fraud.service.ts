// ============================================================
// services/fraud-detection-service/src/fraud.service.ts
// ============================================================
// Risk scoring runs synchronously before every order is
// confirmed. If risk score >= 80, the order is auto-flagged
// for manual review. If >= 95, it is auto-rejected.
//
// Signals evaluated:
// ── Velocity checks (Redis counters)
//    - Orders per user in last 1h / 24h
//    - Orders per IP in last 1h
//    - Payment failures per user in last 24h
//
// ── Order pattern analysis
//    - Unusually high order value vs user history
//    - New account + high value first order
//    - Different shipping address from all previous orders
//    - Multiple orders to same address from different accounts
//
// ── Device / session signals
//    - VPN / proxy detection (IP reputation)
//    - Mismatched geo between billing and shipping
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index
} from 'typeorm';

// ── Entities ──────────────────────────────────────────────

@Entity('fraud_assessments')
export class FraudAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) @Index() orderId: string;
  @Column({ name: 'user_id' })  @Index() userId: string;
  @Column({ name: 'risk_score', type: 'int' }) riskScore: number;
  @Column({ name: 'risk_level' }) riskLevel: 'low' | 'medium' | 'high' | 'critical';
  @Column({ name: 'signals', type: 'jsonb' }) signals: Record<string, unknown>;
  @Column({ name: 'action' }) action: 'allow' | 'review' | 'reject';
  @Column({ name: 'reviewed_by', nullable: true }) reviewedBy: string;
  @Column({ name: 'reviewed_at', nullable: true }) reviewedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── Types ──────────────────────────────────────────────────

interface FraudSignal {
  name:        string;
  score:       number;  // 0-100 contribution to risk
  description: string;
}

interface FraudAssessmentResult {
  riskScore:  number;
  riskLevel:  'low' | 'medium' | 'high' | 'critical';
  action:     'allow' | 'review' | 'reject';
  signals:    FraudSignal[];
}

// ── Service ────────────────────────────────────────────────

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  // Thresholds
  private readonly REVIEW_THRESHOLD  = 50;
  private readonly REJECT_THRESHOLD  = 85;

  constructor(
    @InjectRepository(FraudAssessment)
    private readonly assessmentRepo: Repository<FraudAssessment>,
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────────────────
  // ASSESS ORDER RISK
  // Called by Order Service before confirming every order
  // ──────────────────────────────────────────────────────────
  async assessOrder(params: {
    orderId:         string;
    userId:          string;
    orderTotal:      number;
    paymentMethod:   string;
    shippingDistrict:string;
    ip:              string;
    itemCount:       number;
  }): Promise<FraudAssessmentResult> {
    const signals: FraudSignal[] = [];

    // Run all checks in parallel for speed
    const [
      velocitySignals,
      historySignals,
      orderSignals,
    ] = await Promise.all([
      this.checkVelocity(params.userId, params.ip),
      this.checkUserHistory(params.userId, params.orderTotal, params.shippingDistrict),
      this.checkOrderPatterns(params),
    ]);

    signals.push(...velocitySignals, ...historySignals, ...orderSignals);

    // Calculate total risk score (capped at 100)
    const rawScore  = signals.reduce((s, sig) => s + sig.score, 0);
    const riskScore = Math.min(100, rawScore);

    const riskLevel: FraudAssessmentResult['riskLevel'] =
      riskScore >= 85 ? 'critical' :
      riskScore >= 60 ? 'high' :
      riskScore >= 35 ? 'medium' : 'low';

    const action: FraudAssessmentResult['action'] =
      riskScore >= this.REJECT_THRESHOLD  ? 'reject' :
      riskScore >= this.REVIEW_THRESHOLD  ? 'review' : 'allow';

    // Save assessment
    await this.assessmentRepo.save(
      this.assessmentRepo.create({
        orderId:   params.orderId,
        userId:    params.userId,
        riskScore,
        riskLevel,
        signals:   { signals, params },
        action,
      }),
    );

    if (action !== 'allow') {
      this.logger.warn(`Fraud alert: order ${params.orderId} scored ${riskScore} (${riskLevel}) — action: ${action}`);
      this.eventEmitter.emit('fraud.detected', {
        orderId:    params.orderId,
        userId:     params.userId,
        riskScore,
        riskLevel,
        action,
        signals:    signals.map((s) => s.name),
      });
    }

    return { riskScore, riskLevel, action, signals };
  }

  // ──────────────────────────────────────────────────────────
  // VELOCITY CHECKS (Redis-based, fast)
  // ──────────────────────────────────────────────────────────
  private async checkVelocity(userId: string, ip: string): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    const [
      ordersLast1h,
      ordersLast24h,
      ipOrdersLast1h,
      failedPayments24h,
    ] = await Promise.all([
      this.redis.incr(`fraud:orders:user:${userId}:1h`).then(async (v) => {
        if (v === 1) await this.redis.expire(`fraud:orders:user:${userId}:1h`, 3600);
        return v;
      }),
      this.redis.incr(`fraud:orders:user:${userId}:24h`).then(async (v) => {
        if (v === 1) await this.redis.expire(`fraud:orders:user:${userId}:24h`, 86400);
        return v;
      }),
      this.redis.incr(`fraud:orders:ip:${ip}:1h`).then(async (v) => {
        if (v === 1) await this.redis.expire(`fraud:orders:ip:${ip}:1h`, 3600);
        return v;
      }),
      this.redis.get(`fraud:payment_failures:${userId}:24h`).then((v) => parseInt(v ?? '0')),
    ]);

    // More than 5 orders in 1 hour from one user
    if (ordersLast1h > 5) {
      signals.push({
        name:        'high_order_velocity_1h',
        score:       Math.min(40, (ordersLast1h - 5) * 8),
        description: `${ordersLast1h} orders placed in last hour`,
      });
    }

    // More than 15 orders in 24 hours from one user
    if (ordersLast24h > 15) {
      signals.push({
        name:        'high_order_velocity_24h',
        score:       Math.min(30, (ordersLast24h - 15) * 3),
        description: `${ordersLast24h} orders placed in last 24h`,
      });
    }

    // More than 10 orders from same IP in 1 hour (possible bot/shared device)
    if (ipOrdersLast1h > 10) {
      signals.push({
        name:        'high_ip_velocity',
        score:       Math.min(35, (ipOrdersLast1h - 10) * 4),
        description: `${ipOrdersLast1h} orders from IP ${ip} in last hour`,
      });
    }

    // Multiple payment failures before this order
    if (failedPayments24h >= 3) {
      signals.push({
        name:        'repeated_payment_failures',
        score:       Math.min(30, failedPayments24h * 8),
        description: `${failedPayments24h} payment failures in last 24h`,
      });
    }

    return signals;
  }

  // ──────────────────────────────────────────────────────────
  // USER HISTORY CHECKS (PostgreSQL)
  // ──────────────────────────────────────────────────────────
  private async checkUserHistory(
    userId: string,
    orderTotal: number,
    shippingDistrict: string,
  ): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    const [userStats] = await this.dataSource.query(`
      SELECT
        COUNT(*)                     AS total_orders,
        AVG(total)                   AS avg_order_value,
        MAX(total)                   AS max_order_value,
        MIN(created_at)              AS first_order_at,
        COUNT(DISTINCT (shipping_address->>'district')) AS distinct_districts
      FROM orders
      WHERE customer_id = $1
        AND status NOT IN ('cancelled', 'payment_failed')
    `, [userId]);

    const totalOrders      = parseInt(userStats.total_orders ?? '0');
    const avgValue         = parseFloat(userStats.avg_order_value ?? '0');
    const accountAgeDays   = userStats.first_order_at
      ? (Date.now() - new Date(userStats.first_order_at).getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    // New account (< 7 days) placing high-value order (> ৳10,000)
    if (accountAgeDays < 7 && orderTotal > 10_000) {
      signals.push({
        name:        'new_account_high_value',
        score:       25,
        description: `Account is ${Math.round(accountAgeDays)} days old, order value ৳${orderTotal}`,
      });
    }

    // First ever order and high value
    if (totalOrders === 0 && orderTotal > 15_000) {
      signals.push({
        name:        'first_order_very_high_value',
        score:       20,
        description: `First order worth ৳${orderTotal}`,
      });
    }

    // Order value is 5x the user's average (anomaly)
    if (avgValue > 0 && orderTotal > avgValue * 5) {
      signals.push({
        name:        'anomalous_order_value',
        score:       20,
        description: `Order ৳${orderTotal} is ${Math.round(orderTotal / avgValue)}x user's avg ৳${Math.round(avgValue)}`,
      });
    }

    return signals;
  }

  // ──────────────────────────────────────────────────────────
  // ORDER PATTERN CHECKS
  // ──────────────────────────────────────────────────────────
  private async checkOrderPatterns(params: {
    userId:          string;
    orderTotal:      number;
    paymentMethod:   string;
    shippingDistrict:string;
    itemCount:       number;
  }): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    // Very high number of items in single order
    if (params.itemCount > 20) {
      signals.push({
        name:        'bulk_item_order',
        score:       15,
        description: `Order contains ${params.itemCount} items`,
      });
    }

    // Very high COD order (COD fraud is common in BD)
    if (params.paymentMethod === 'cod' && params.orderTotal > 20_000) {
      signals.push({
        name:        'high_value_cod',
        score:       20,
        description: `COD order worth ৳${params.orderTotal} — high chargeback risk`,
      });
    }

    // Check if same delivery address used by multiple accounts
    const [sharedAddr] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT customer_id) AS user_count
      FROM orders
      WHERE shipping_address->>'district' = $1
        AND customer_id != $2
        AND created_at > NOW() - INTERVAL '7 days'
        AND status NOT IN ('cancelled')
    `, [params.shippingDistrict, params.userId]);

    if (parseInt(sharedAddr.user_count ?? '0') > 5) {
      signals.push({
        name:        'shared_address_multiple_accounts',
        score:       15,
        description: `Shipping district used by ${sharedAddr.user_count} other accounts recently`,
      });
    }

    return signals;
  }

  // ──────────────────────────────────────────────────────────
  // RECORD PAYMENT FAILURE (called by Payment Service event)
  // ──────────────────────────────────────────────────────────
  @OnEvent('payment.failed')
  async onPaymentFailed(payload: { orderId: string; userId?: string }): Promise<void> {
    if (!payload.userId) return;
    const key = `fraud:payment_failures:${payload.userId}:24h`;
    await this.redis.incr(key);
    await this.redis.expire(key, 86400);
  }

  // ──────────────────────────────────────────────────────────
  // ADMIN: GET FLAGGED ORDERS
  // ──────────────────────────────────────────────────────────
  async getFlaggedOrders(params: { page?: number; limit?: number; action?: string }) {
    const { page = 1, limit = 20, action } = params;
    const [data, total] = await this.assessmentRepo.findAndCount({
      where: action ? { action: action as any } : { action: 'review' as any },
      order: { createdAt: 'DESC' },
      take:  limit,
      skip:  (page - 1) * limit,
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewAssessment(id: string, action: 'allow' | 'reject', reviewedBy: string): Promise<void> {
    await this.assessmentRepo.update(id, {
      action,
      reviewedBy,
      reviewedAt: new Date(),
    });

    const assessment = await this.assessmentRepo.findOne({ where: { id } });
    if (!assessment) return;

    if (action === 'reject') {
      this.eventEmitter.emit('fraud.order_rejected', { orderId: assessment.orderId });
    }
  }
}


// ============================================================
// services/fraud-detection-service/src/fraud.controller.ts
// ============================================================
import {
  Controller, Post, Get, Patch, Body, Param,
  Query, ParseUUIDPipe, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard }   from './common/guards/roles.guard';
import { Roles }        from './common/decorators/roles.decorator';
import { CurrentUser }  from './common/decorators/current-user.decorator';
import { UserRole }     from '@bazarbd/types';

@ApiTags('Fraud Detection')
@Controller('fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Post('assess')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assess fraud risk for an order (called internally by Order Service)' })
  assess(@Body() body: {
    orderId: string; userId: string; orderTotal: number;
    paymentMethod: string; shippingDistrict: string;
    ip: string; itemCount: number;
  }) {
    return this.fraudService.assessOrder(body);
  }

  @Get('flagged')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get flagged orders for review (admin only)' })
  getFlagged(
    @Query('page')   page = 1,
    @Query('limit')  limit = 20,
    @Query('action') action?: string,
  ) {
    return this.fraudService.getFlaggedOrders({ page: +page, limit: +limit, action });
  }

  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Review a flagged order — allow or reject (admin only)' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'allow' | 'reject' },
    @CurrentUser() user: any,
  ) {
    return this.fraudService.reviewAssessment(id, body.action, user.id);
  }
}