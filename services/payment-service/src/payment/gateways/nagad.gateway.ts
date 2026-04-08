import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHash, createSign, privateDecrypt, constants } from 'crypto';

@Injectable()
export class NagadGateway {
  private readonly logger = new Logger(NagadGateway.name);
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly privateKey: string;
  private readonly nagadPublicKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl        = config.get('nagad.baseUrl')!;
    this.merchantId     = config.get('nagad.merchantId')!;
    this.privateKey     = config.get('nagad.merchantPrivateKey')!;
    this.nagadPublicKey = config.get('nagad.nagadPublicKey')!;
  }

  private signData(data: string): string {
    const sign = createSign('RSA-SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKey, 'base64');
  }

  private decryptData(encryptedData: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = privateDecrypt(
      { key: this.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
      buffer,
    );
    return decrypted.toString('utf8');
  }

  async initiatePayment(params: {
    orderId: string; amount: number; callbackUrl: string; ip: string;
  }): Promise<{ redirectUrl: string; paymentReferenceId: string }> {
    const dateTime = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const merchantOrderId = `BD-${params.orderId.slice(0, 8)}-${dateTime}`;

    const sensitiveData = {
      merchantId: this.merchantId, datetime: dateTime,
      orderId: merchantOrderId,
      challenge: createHash('sha256').update(merchantOrderId + dateTime).digest('hex').slice(0, 20),
    };
    const signedData = this.signData(JSON.stringify(sensitiveData));

    const initRes = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/api/dfs/check-out/initialize/${this.merchantId}/${merchantOrderId}`,
        { dateTime, sensitiveData: Buffer.from(JSON.stringify(sensitiveData)).toString('base64'), signature: signedData },
        { headers: { 'X-KM-Api-Version': 'v-0.2.0', 'X-KM-IP-V4': params.ip, 'X-KM-Client-Type': 'PC_WEB', 'Content-Type': 'application/json' } },
      ),
    );

    const initData = initRes.data;
    const paymentReferenceId = initData.paymentReferenceId;
    const challenge = this.decryptData(initData.sensitiveData);

    const completeSensitiveData = {
      merchantId: this.merchantId, orderId: merchantOrderId,
      amount: params.amount.toFixed(2), currencyCode: '050', challenge,
    };
    const completeSignedData = this.signData(JSON.stringify(completeSensitiveData));

    const completeRes = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/api/dfs/check-out/complete/${paymentReferenceId}`,
        {
          sensitiveData: Buffer.from(JSON.stringify(completeSensitiveData)).toString('base64'),
          signature: completeSignedData, merchantCallbackURL: params.callbackUrl,
        },
        { headers: { 'X-KM-Api-Version': 'v-0.2.0', 'X-KM-IP-V4': params.ip, 'X-KM-Client-Type': 'PC_WEB', 'Content-Type': 'application/json' } },
      ),
    );

    this.logger.log(`Nagad payment initiated: ${paymentReferenceId} for order ${params.orderId}`);
    return { redirectUrl: completeRes.data.callBackUrl, paymentReferenceId };
  }

  async verifyPayment(paymentRefId: string): Promise<Record<string, unknown>> {
    const response = await firstValueFrom(
      this.http.get(
        `${this.baseUrl}/api/dfs/verify/payment/${paymentRefId}`,
        { headers: { 'X-KM-Api-Version': 'v-0.2.0' } },
      ),
    );
    return response.data;
  }
}
