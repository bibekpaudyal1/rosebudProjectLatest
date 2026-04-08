import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import * as crypto from 'crypto';

@Injectable()
export class SslcommerzGateway {
  private readonly logger = new Logger(SslcommerzGateway.name);
  private readonly storeId: string;
  private readonly storePassword: string;
  private readonly isLive: boolean;

  private get baseUrl(): string {
    return this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.storeId       = config.get('sslcommerz.storeId')!;
    this.storePassword = config.get('sslcommerz.storePassword')!;
    this.isLive        = config.get<boolean>('sslcommerz.isLive') ?? false;
  }

  async initiatePayment(params: {
    orderId: string; amount: number;
    customerName: string; customerEmail: string;
    customerPhone: string; customerAddress: string;
    successUrl: string; failUrl: string; cancelUrl: string; ipnUrl: string;
  }): Promise<{ gatewayUrl: string; sessionKey: string }> {
    const payload = new URLSearchParams({
      store_id: this.storeId, store_passwd: this.storePassword,
      total_amount: params.amount.toFixed(2), currency: 'BDT',
      tran_id: `BD-${params.orderId.slice(0, 12).toUpperCase()}`,
      success_url: params.successUrl, fail_url: params.failUrl,
      cancel_url: params.cancelUrl, ipn_url: params.ipnUrl,
      cus_name: params.customerName,
      cus_email: params.customerEmail || 'customer@bazarbd.com',
      cus_phone: params.customerPhone,
      cus_add1: params.customerAddress, cus_city: 'Dhaka', cus_country: 'Bangladesh',
      shipping_method: 'YES', ship_name: params.customerName,
      ship_add1: params.customerAddress, ship_city: 'Dhaka', ship_country: 'Bangladesh',
      product_name: 'BazarBD Order', product_category: 'General', product_profile: 'general',
    });

    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/gwprocess/v4/api.php`,
        payload.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    if (response.data.status !== 'SUCCESS') {
      throw new UnprocessableEntityException(`SSLCommerz session creation failed: ${response.data.failedreason}`);
    }

    this.logger.log(`SSLCommerz session created for order ${params.orderId}`);
    return { gatewayUrl: response.data.GatewayPageURL, sessionKey: response.data.sessionkey };
  }

  verifyIpnSignature(payload: Record<string, string>): boolean {
    const { verify_sign, verify_key } = payload;
    if (!verify_sign || !verify_key) return false;
    const keys = verify_key.split(',');
    const hashString = keys
      .map((k) => `${k}=${payload[k] ?? ''}`)
      .join('&') + `&store_passwd=${createHash('md5').update(this.storePassword).digest('hex')}`;
    const expected = createHash('md5').update(hashString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(verify_sign));
  }

  async validateTransaction(valId: string, amount: number, currency = 'BDT'): Promise<Record<string, unknown>> {
    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/validator/api/validationserverAPI.php`, {
        params: { val_id: valId, store_id: this.storeId, store_passwd: this.storePassword, v: 1, format: 'json' },
      }),
    );
    const data = response.data;
    if (data.status !== 'VALID' && data.status !== 'VALIDATED') {
      throw new UnprocessableEntityException(`SSLCommerz validation failed: ${data.status}`);
    }
    if (Math.abs(Number(data.amount) - amount) > 1) {
      throw new UnprocessableEntityException('SSLCommerz amount mismatch — possible tampering');
    }
    return data;
  }

  async refund(params: { bankTranId: string; refundAmount: number; refundRemarks: string }): Promise<Record<string, unknown>> {
    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php`, {
        params: {
          store_id: this.storeId, store_passwd: this.storePassword,
          bank_tran_id: params.bankTranId, refund_amount: params.refundAmount.toFixed(2),
          refund_remarks: params.refundRemarks, v: 1, format: 'json',
        },
      }),
    );
    return response.data;
  }
}
