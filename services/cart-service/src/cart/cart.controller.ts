import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Headers, HttpCode, HttpStatus, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@bazarbd/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get cart (guest: pass X-Session-Id header)' })
  @ApiHeader({ name: 'X-Session-Id', required: false })
  getCart(@CurrentUser() user: any, @Headers('x-session-id') sid?: string) {
    return this.cartService.getCart(user?.id, sid);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  addItem(@Body() dto: AddToCartDto, @CurrentUser() user: any, @Headers('x-session-id') sid?: string) {
    return this.cartService.addItem(dto, user?.id, sid);
  }

  @Patch('items/:variantId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateItem(@Param('variantId') vid: string, @Body() dto: UpdateCartItemDto, @CurrentUser() user: any, @Headers('x-session-id') sid?: string) {
    return this.cartService.updateItem(vid, dto, user?.id, sid);
  }

  @Delete('items/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  removeItem(@Param('variantId') vid: string, @CurrentUser() user: any, @Headers('x-session-id') sid?: string) {
    return this.cartService.removeItem(vid, user?.id, sid);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear entire cart' })
  clearCart(@CurrentUser() user: any, @Headers('x-session-id') sid?: string) {
    return this.cartService.clearCart(user?.id, sid);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart into user cart on login' })
  mergeCarts(@CurrentUser() user: any, @Headers('x-session-id') sid: string) {
    return this.cartService.mergeCarts(sid, user.id);
  }
}
