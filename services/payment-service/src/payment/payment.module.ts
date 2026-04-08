import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Payment } from './entities/payment.entity';
import { PaymentRefund } from './entities/payment-refund.entity';
import { BkashGateway } from './gateways/bkash.gateway';
import { NagadGateway } from './gateways/nagad.gateway';
import { SslcommerzGateway } from './gateways/sslcommerz.gateway';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentRefund]),
    HttpModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, BkashGateway, NagadGateway, SslcommerzGateway],
  exports: [PaymentService],
})
export class PaymentModule {}
