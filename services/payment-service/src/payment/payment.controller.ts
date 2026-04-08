import {
  Controller, Post, Get, Body, Param, Query, Req,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@bazarbd/types';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, Public } from '@bazarbd/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentRequestDto, RefundRequestDto } from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for an order' })
  async initiate(@Body() dto: InitiatePaymentRequestDto, @CurrentUser() user: any, @Req() req: Request) {
    return this.paymentService.initiate({
      ...dto, ip: req.ip,
      customerName: user.fullName, customerPhone: user.phone, customerEmail: user.email,
    });
  }

  @Get('bkash/callback')
  @Public()
  @ApiOperation({ summary: 'bKash payment callback' })
  async bkashCallback(
    @Query('paymentId') paymentId: string,
    @Query('paymentID') bkashPaymentId: string,
    @Query('status') status: string,
  ) {
    await this.paymentService.handleBkashCallback(paymentId, bkashPaymentId, status);
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return { redirect: `${baseUrl}/checkout/${status === 'success' ? 'success' : 'failed'}?paymentId=${paymentId}` };
  }

  @Get('nagad/callback')
  @Public()
  @ApiOperation({ summary: 'Nagad payment callback' })
  async nagadCallback(
    @Query('paymentId') paymentId: string,
    @Query('payment_ref_id') paymentRefId: string,
  ) {
    await this.paymentService.handleNagadCallback(paymentId, paymentRefId);
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return { redirect: `${baseUrl}/checkout/success?paymentId=${paymentId}` };
  }

  @Post('sslcommerz/ipn')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz IPN webhook' })
  async sslcommerzIpn(@Body() body: Record<string, string>) {
    await this.paymentService.handleSslcommerzIpn(body);
    return { status: 'OK' };
  }

  @Post('sslcommerz/success')
  @Public()
  @HttpCode(HttpStatus.OK)
  async sslcommerzSuccess(@Query('paymentId') paymentId: string, @Body() body: Record<string, string>) {
    await this.paymentService.handleSslcommerzIpn(body);
    return { paymentId, status: 'success' };
  }

  @Post('sslcommerz/fail')
  @Public()
  @HttpCode(HttpStatus.OK)
  async sslcommerzFail(@Query('paymentId') paymentId: string) {
    return { paymentId, status: 'failed' };
  }

  @Post('sslcommerz/cancel')
  @Public()
  @HttpCode(HttpStatus.OK)
  async sslcommerzCancel(@Query('paymentId') paymentId: string) {
    return { paymentId, status: 'cancelled' };
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process refund (admin only)' })
  async refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundRequestDto) {
    return this.paymentService.refund(id, dto.amount, dto.reason);
  }

  @Post(':id/cod-collected')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark COD as collected (admin / delivery)' })
  async markCodCollected(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.paymentService.markCodCollected(id, user.id);
  }
}
