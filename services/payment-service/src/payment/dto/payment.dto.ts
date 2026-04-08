import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@bazarbd/types';

export class InitiatePaymentDto {
  orderId: string;
  gateway: PaymentMethod;
  callbackUrl?: string;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  ip?: string;
}

export class InitiatePaymentRequestDto {
  @ApiProperty() orderId: string;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) gateway: PaymentMethod;
}

export class RefundRequestDto {
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiProperty() @IsString() reason: string;
}
