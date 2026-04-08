import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

interface BkashTokenResponse {
  id_token: string; token_type: string; expires_in: number; refresh_token: string;
}

interface BkashCreatePaymentResponse {
  paymentID: string; bkashURL: string; callbackURL: string;
  successCallbackURL: string; failureCallbackURL: string; cancelledCallbackURL: string;
  amount: string; intent: string; currency: string; merchantInvoiceNumber: string;
}

interface BkashExecutePaymentResponse {
  paymentID: string; trxID: string; transactionStatus: string;
  amount: string; currency: string; intent: string; paymentExecuteTime: string;
  merchantInvoiceNumber: string; customerMsisdn: string;
}

@Injectable()
export class BkashGateway {
  private readonly logger = new Logger(BkashGateway.name);
  private readonly baseUrl: string;
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly username: string;
  private readonly password: string;
  private readonly TOKEN_CACHE_KEY = 'bkash:access_token';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.baseUrl   = config.get('bkash.baseUrl')!;
    this.appKey    = config.get('bkash.appKey')!;
    this.appSecret = config.get('bkash.appSecret')!;
    this.username  = config.get('bkash.username')!;
    this.password  = config.get('bkash.password')!;
  }

  private async getToken(): Promise<string> {
    const cached = await this.redis.get(this.TOKEN_CACHE_KEY);
    if (cached) return cached;
    const response = await firstValueFrom(
      this.http.post<BkashTokenResponse>(
        `${this.baseUrl}/tokenized/checkout/token/grant`,
        { app_key: this.appKey, app_secret: this.appSecret },
        { headers: { username: this.username, password: this.password, 'Content-Type': 'application/json' } },
      ),
    );
    const token = response.data.id_token;
    await this.redis.setex(this.TOKEN_CACHE_KEY, 3300, token);
    return token;
  }

  private authHeaders() {
    return { 'Content-Type': 'application/json', Accept: 'application/json', authorization: this.appKey };
  }

  async createPayment(params: { orderId: string; amount: number; callbackUrl: string }): Promise<BkashCreatePaymentResponse> {
    const token = await this.getToken();
    const response = await firstValueFrom(
      this.http.post<BkashCreatePaymentResponse>(
        `${this.baseUrl}/tokenized/checkout/create`,
        {
          mode: '0011', payerReference: params.orderId, callbackURL: params.callbackUrl,
          amount: params.amount.toFixed(2), currency: 'BDT', intent: 'sale',
          merchantInvoiceNumber: `BD-${params.orderId.slice(0, 8).toUpperCase()}`,
        },
        { headers: { ...this.authHeaders(), 'x-app-key': this.appKey, Authorization: token } },
      ),
    );
    if (!response.data.paymentID) throw new UnprocessableEntityException('bKash payment creation failed');
    this.logger.log(`bKash payment created: ${response.data.paymentID} for order ${params.orderId}`);
    return response.data;
  }

  async executePayment(paymentId: string): Promise<BkashExecutePaymentResponse> {
    const token = await this.getToken();
    const response = await firstValueFrom(
      this.http.post<BkashExecutePaymentResponse>(
        `${this.baseUrl}/tokenized/checkout/execute`,
        { paymentID: paymentId },
        { headers: { ...this.authHeaders(), 'x-app-key': this.appKey, Authorization: token } },
      ),
    );
    return response.data;
  }

  async queryPayment(paymentId: string): Promise<Record<string, unknown>> {
    const token = await this.getToken();
    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/tokenized/checkout/payment/status`,
        { paymentID: paymentId },
        { headers: { ...this.authHeaders(), 'x-app-key': this.appKey, Authorization: token } },
      ),
    );
    return response.data;
  }

  async refund(params: { paymentId: string; trxId: string; orderId: string; amount: number; reason: string }): Promise<Record<string, unknown>> {
    const token = await this.getToken();
    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/tokenized/checkout/payment/refund`,
        { paymentID: params.paymentId, trxID: params.trxId, amount: params.amount.toFixed(2), SKU: params.orderId, reason: params.reason },
        { headers: { ...this.authHeaders(), 'x-app-key': this.appKey, Authorization: token } },
      ),
    );
    return response.data;
  }

  isSuccessful(status: string): boolean { return status === 'Completed'; }
}
