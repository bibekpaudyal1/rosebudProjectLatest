import {
  Injectable, NotFoundException, BadRequestException,
  UnprocessableEntityException, Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PaymentMethod, PaymentStatus } from '@bazarbd/types';
import { Payment } from './entities/payment.entity';
import { PaymentRefund } from './entities/payment-refund.entity';
import { BkashGateway } from './gateways/bkash.gateway';
import { NagadGateway } from './gateways/nagad.gateway';
import { SslcommerzGateway } from './gateways/sslcommerz.gateway';
import { InitiatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentRefund) private readonly refundRepo: Repository<PaymentRefund>,
    private readonly bkash: BkashGateway,
    private readonly nagad: NagadGateway,
    private readonly sslcommerz: SslcommerzGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async initiate(dto: InitiatePaymentDto): Promise<{
    paymentId: string; redirectUrl?: string; gatewayData?: unknown;
  }> {
    const orderRes = await firstValueFrom(
      this.http.get(`${this.config.get('services.orderServiceUrl')}/orders/${dto.orderId}`),
    ).catch(() => { throw new NotFoundException(`Order ${dto.orderId} not found`); });

    const order = orderRes.data.data;
    const amount = Number(order.total);
    if (amount <= 0) throw new BadRequestException('Order total must be greater than 0');

    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({ orderId: dto.orderId, gateway: dto.gateway, amount, status: PaymentStatus.INITIATED }),
    );
    const baseCallbackUrl = this.config.get<string>('app.baseUrl');

    try {
      switch (dto.gateway) {
        case PaymentMethod.BKASH: {
          const bkashData = await this.bkash.createPayment({
            orderId: dto.orderId, amount,
            callbackUrl: `${baseCallbackUrl}/payments/bkash/callback?paymentId=${payment.id}`,
          });
          await this.paymentRepo.update(payment.id, { gatewayOrderId: bkashData.paymentID, status: PaymentStatus.PENDING });
          return { paymentId: payment.id, redirectUrl: bkashData.bkashURL, gatewayData: bkashData };
        }
        case PaymentMethod.NAGAD: {
          const nagadData = await this.nagad.initiatePayment({
            orderId: dto.orderId, amount,
            callbackUrl: `${baseCallbackUrl}/payments/nagad/callback?paymentId=${payment.id}`,
            ip: dto.ip ?? '127.0.0.1',
          });
          await this.paymentRepo.update(payment.id, { gatewayOrderId: nagadData.paymentReferenceId, status: PaymentStatus.PENDING });
          return { paymentId: payment.id, redirectUrl: nagadData.redirectUrl };
        }
        case PaymentMethod.SSLCOMMERZ: {
          const sslData = await this.sslcommerz.initiatePayment({
            orderId: dto.orderId, amount,
            customerName: dto.customerName ?? 'Customer', customerEmail: dto.customerEmail ?? 'customer@bazarbd.com',
            customerPhone: dto.customerPhone ?? '', customerAddress: dto.customerAddress ?? 'Dhaka, Bangladesh',
            successUrl: `${baseCallbackUrl}/payments/sslcommerz/success?paymentId=${payment.id}`,
            failUrl: `${baseCallbackUrl}/payments/sslcommerz/fail?paymentId=${payment.id}`,
            cancelUrl: `${baseCallbackUrl}/payments/sslcommerz/cancel?paymentId=${payment.id}`,
            ipnUrl: `${baseCallbackUrl}/payments/sslcommerz/ipn`,
          });
          await this.paymentRepo.update(payment.id, { gatewayOrderId: sslData.sessionKey, status: PaymentStatus.PENDING });
          return { paymentId: payment.id, redirectUrl: sslData.gatewayUrl };
        }
        case PaymentMethod.COD: {
          await this.paymentRepo.update(payment.id, { status: PaymentStatus.PENDING });
          return { paymentId: payment.id };
        }
        default:
          throw new BadRequestException(`Unsupported payment gateway: ${dto.gateway}`);
      }
    } catch (err) {
      await this.paymentRepo.update(payment.id, { status: PaymentStatus.FAILED, failureReason: (err as Error).message });
      throw err;
    }
  }

  async handleBkashCallback(paymentId: string, bkashPaymentId: string, status: string): Promise<void> {
    const payment = await this.findOrFail(paymentId);
    if (status !== 'success') { await this.markFailed(payment, `bKash status: ${status}`); return; }
    const result = await this.bkash.executePayment(bkashPaymentId);
    if (this.bkash.isSuccessful(result.transactionStatus)) {
      await this.markCompleted(payment, result.trxID, result as unknown as Record<string, unknown>);
    } else {
      await this.markFailed(payment, `bKash transaction status: ${result.transactionStatus}`);
    }
  }

  async handleNagadCallback(paymentId: string, paymentRefId: string): Promise<void> {
    const payment = await this.findOrFail(paymentId);
    const result = await this.nagad.verifyPayment(paymentRefId);
    if ((result as any).status === 'Success') {
      await this.markCompleted(payment, (result as any).merchantOrderId, result);
    } else {
      await this.markFailed(payment, `Nagad status: ${(result as any).status}`);
    }
  }

  async handleSslcommerzIpn(payload: Record<string, string>): Promise<void> {
    if (!this.sslcommerz.verifyIpnSignature(payload)) {
      this.logger.warn('SSLCommerz IPN signature verification FAILED');
      return;
    }
    const tranId = payload.tran_id;
    const orderId = tranId.replace('BD-', '').slice(0, 12).toLowerCase();
    const payment = await this.paymentRepo.findOne({
      where: { orderId, gateway: PaymentMethod.SSLCOMMERZ }, order: { createdAt: 'DESC' },
    });
    if (!payment) { this.logger.warn(`Payment not found for SSLCommerz tran_id: ${tranId}`); return; }
    if (payment.status === PaymentStatus.COMPLETED) return;

    if (payload.status === 'VALID' || payload.status === 'VALIDATED') {
      const validated = await this.sslcommerz.validateTransaction(payload.val_id, payment.amount);
      await this.markCompleted(payment, payload.bank_tran_id, validated);
    } else {
      await this.markFailed(payment, `SSLCommerz status: ${payload.status}`);
    }
  }

  async markCodCollected(paymentId: string, collectedBy: string): Promise<void> {
    const payment = await this.findOrFail(paymentId);
    if (payment.gateway !== PaymentMethod.COD) throw new BadRequestException('Not a COD payment');
    await this.markCompleted(payment, `COD-${Date.now()}`, { collectedBy });
  }

  async refund(paymentId: string, amount: number, reason: string): Promise<PaymentRefund> {
    const payment = await this.findOrFail(paymentId);
    if (payment.status !== PaymentStatus.COMPLETED) throw new BadRequestException('Can only refund a completed payment');
    if (amount > payment.amount) throw new BadRequestException('Refund amount exceeds original payment');

    const refund = this.refundRepo.create({ paymentId, amount, reason, status: 'processing' });
    const savedRefund = await this.refundRepo.save(refund);

    try {
      let gatewayRefundId: string | undefined;
      switch (payment.gateway) {
        case PaymentMethod.BKASH: {
          const result = await this.bkash.refund({ paymentId: payment.gatewayOrderId, trxId: payment.gatewayTxnId, orderId: payment.orderId, amount, reason });
          gatewayRefundId = (result as any).refundTrxID;
          break;
        }
        case PaymentMethod.SSLCOMMERZ: {
          const result = await this.sslcommerz.refund({ bankTranId: payment.gatewayTxnId, refundAmount: amount, refundRemarks: reason });
          gatewayRefundId = (result as any).bank_tran_id;
          break;
        }
        case PaymentMethod.COD:
          gatewayRefundId = `COD-REFUND-${Date.now()}`;
          break;
      }
      await this.refundRepo.update(savedRefund.id, { status: 'completed', gatewayRefundId, processedAt: new Date() });
      await this.paymentRepo.update(payment.id, {
        status: amount >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        refundedAt: new Date(),
      });
      this.eventEmitter.emit('payment.refunded', { paymentId: payment.id, orderId: payment.orderId, amount, refundId: savedRefund.id });
      this.logger.log(`Refund processed: ${savedRefund.id} for payment ${paymentId}`);
      return { ...savedRefund, status: 'completed', gatewayRefundId } as PaymentRefund;
    } catch (err) {
      await this.refundRepo.update(savedRefund.id, { status: 'failed' });
      throw err;
    }
  }

  private async findOrFail(paymentId: string): Promise<Payment> {
    const p = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!p) throw new NotFoundException(`Payment ${paymentId} not found`);
    return p;
  }

  private async markCompleted(
    payment: Payment,
    txnId: string,
    gatewayResponse: Record<string, unknown>,
  ): Promise<void> {
    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.COMPLETED,
      gatewayTxnId: txnId,
      gatewayResponse: gatewayResponse as any,
      paidAt: new Date(),
    });
    this.eventEmitter.emit('payment.completed', { paymentId: payment.id, orderId: payment.orderId, amount: payment.amount, gateway: payment.gateway });
    this.logger.log(`Payment completed: ${payment.id} txn: ${txnId}`);
  }

  private async markFailed(payment: Payment, reason: string): Promise<void> {
    await this.paymentRepo.update(payment.id, { status: PaymentStatus.FAILED, failureReason: reason });
    this.eventEmitter.emit('payment.failed', { paymentId: payment.id, orderId: payment.orderId, reason });
    this.logger.warn(`Payment failed: ${payment.id} — ${reason}`);
  }
}
