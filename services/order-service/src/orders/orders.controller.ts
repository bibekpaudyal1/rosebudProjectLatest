import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@bazarbd/types';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@bazarbd/common';
import { OrdersService } from './orders.service';
import { CreateOrderRequestDto, UpdateOrderStatusDto } from './dto/order.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order from cart' })
  async create(@CurrentUser() user: any, @Body() dto: CreateOrderRequestDto) {
    return this.ordersService.createFromCart(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'My orders' })
  async myOrders(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.ordersService.findByCustomer(user.id, +page, +limit);
  }

  @Get('seller')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Seller's order items" })
  async sellerOrders(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.ordersService.findBySeller(user.sellerId ?? user.id, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.ordersService.findById(id, user.id, user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Update order status (seller / admin)' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto, user.id, user.role);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Body('reason') reason?: string) {
    return this.ordersService.cancel(id, user.id, user.role, reason);
  }
}
