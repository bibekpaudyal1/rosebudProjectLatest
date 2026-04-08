// ============================================================
// services/cart-service/src/cart/cart.service.ts
// Cart is Redis-primary for speed.
// Authenticated user carts are persisted async to PostgreSQL.
// Guest carts live only in Redis with 24h TTL.
// Cart merges on login: guest → authenticated.
// ============================================================
import {
  Injectable, NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, ManyToOne, JoinColumn
} from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Headers, HttpCode, HttpStatus, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';

// ── Entities ──────────────────────────────────────────────

@Entity('carts')
export class CartEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', nullable: true }) userId: string;
  @Column({ name: 'session_id', nullable: true }) sessionId: string;
  @Column({ name: 'expires_at' }) expiresAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => CartItemEntity, (i) => i.cart, { cascade: true, eager: true })
  items: CartItemEntity[];
}

@Entity('cart_items')
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'cart_id' }) cartId: string;
  @Column({ name: 'variant_id' }) variantId: string;
  @Column({ type: 'int', default: 1 }) quantity: number;
  @Column({ name: 'added_at', default: () => 'NOW()' }) addedAt: Date;
  @ManyToOne(() => CartEntity, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' }) cart: CartEntity;
}

// ── DTOs ──────────────────────────────────────────────────

export class AddToCartDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty({ minimum: 1, maximum: 99 }) @IsInt() @Min(1) @Max(99) quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, maximum: 99, description: 'Set to 0 to remove item' })
  @IsInt() @Min(0) @Max(99) quantity: number;
}

// ── In-memory cart shape ───────────────────────────────────

export interface CartItem {
  id: string; variantId: string; quantity: number;
  variant?: { id: string; sku: string; name: string; price: number; imageUrl?: string; attributes: Record<string, string>; product?: { id: string; name: string; thumbnailUrl?: string; sellerId: string } };
  unitPrice: number; totalPrice: number;
}

export interface CartData {
  id: string; userId?: string; sessionId?: string;
  items: CartItem[]; subtotal: number; itemCount: number; expiresAt: string;
}

const AUTH_TTL  = 7 * 24 * 3600;
const GUEST_TTL = 24 * 3600;

// ── Service ────────────────────────────────────────────────

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(CartEntity) private readonly cartRepo: Repository<CartEntity>,
    @InjectRepository(CartItemEntity) private readonly itemRepo: Repository<CartItemEntity>,
    @InjectRedis() private readonly redis: Redis,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getCart(userId?: string, sessionId?: string): Promise<CartData> {
    const key = this.key(userId, sessionId);
    const raw = await this.redis.get(key);
    if (raw) return JSON.parse(raw);

    // Rebuild from DB for authenticated users
    if (userId) {
      const db = await this.cartRepo.findOne({ where: { userId }, relations: ['items'] });
      if (db) {
        const hydrated = await this.hydrateFromDb(db.id, userId, db.items);
        await this.toRedis(key, hydrated, AUTH_TTL);
        return hydrated;
      }
    }

    const empty = this.makeEmpty(userId, sessionId);
    await this.toRedis(key, empty, userId ? AUTH_TTL : GUEST_TTL);
    return empty;
  }

  async addItem(dto: AddToCartDto, userId?: string, sessionId?: string): Promise<CartData> {
    const variant = await this.fetchVariant(dto.variantId);
    if (!variant) throw new NotFoundException(`Variant ${dto.variantId} not found`);

    // Fast stock check from Redis cache
    const stock = await this.redis.get(`stock:available:${dto.variantId}`);
    if (stock !== null && parseInt(stock) < dto.quantity) {
      throw new BadRequestException(`Only ${stock} units available`);
    }

    const cart = await this.getCart(userId, sessionId);
    const idx = cart.items.findIndex((i) => i.variantId === dto.variantId);

    if (idx >= 0) {
      cart.items[idx].quantity = Math.min(99, cart.items[idx].quantity + dto.quantity);
      cart.items[idx].totalPrice = cart.items[idx].unitPrice * cart.items[idx].quantity;
    } else {
      cart.items.push({
        id: crypto.randomUUID(),
        variantId: dto.variantId,
        quantity: dto.quantity,
        variant,
        unitPrice: Number(variant.price),
        totalPrice: Number(variant.price) * dto.quantity,
      });
    }

    this.calc(cart);
    await this.persist(cart, userId, sessionId);
    return cart;
  }

  async updateItem(variantId: string, dto: UpdateCartItemDto, userId?: string, sessionId?: string): Promise<CartData> {
    const cart = await this.getCart(userId, sessionId);
    const idx = cart.items.findIndex((i) => i.variantId === variantId);
    if (idx === -1) throw new NotFoundException('Item not in cart');

    if (dto.quantity === 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = dto.quantity;
      cart.items[idx].totalPrice = cart.items[idx].unitPrice * dto.quantity;
    }

    this.calc(cart);
    await this.persist(cart, userId, sessionId);
    return cart;
  }

  async removeItem(variantId: string, userId?: string, sessionId?: string): Promise<CartData> {
    return this.updateItem(variantId, { quantity: 0 }, userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    const key = this.key(userId, sessionId);
    await this.redis.del(key);
    if (userId) await this.cartRepo.delete({ userId });
  }

  async mergeCarts(sessionId: string, userId: string): Promise<CartData> {
    const guestCart = await this.getCart(undefined, sessionId);
    if (!guestCart.items.length) return this.getCart(userId);

    const userCart = await this.getCart(userId);
    for (const gi of guestCart.items) {
      const idx = userCart.items.findIndex((i) => i.variantId === gi.variantId);
      if (idx >= 0) {
        userCart.items[idx].quantity = Math.min(99, userCart.items[idx].quantity + gi.quantity);
        userCart.items[idx].totalPrice = userCart.items[idx].unitPrice * userCart.items[idx].quantity;
      } else {
        userCart.items.push(gi);
      }
    }

    this.calc(userCart);
    await this.clearCart(undefined, sessionId);
    await this.persist(userCart, userId, undefined);
    return userCart;
  }

  // ── Private helpers ────────────────────────────────────

  private key(userId?: string, sessionId?: string): string {
    if (userId) return `cart:${userId}`;
    if (sessionId) return `cart:guest:${sessionId}`;
    throw new BadRequestException('userId or sessionId required');
  }

  private calc(cart: CartData): void {
    cart.subtotal = Math.round(cart.items.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100;
    cart.itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  }

  private makeEmpty(userId?: string, sessionId?: string): CartData {
    const ttl = userId ? AUTH_TTL : GUEST_TTL;
    return { id: crypto.randomUUID(), userId, sessionId, items: [], subtotal: 0, itemCount: 0, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }

  private async toRedis(key: string, cart: CartData, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(cart));
  }

  private async persist(cart: CartData, userId?: string, sessionId?: string): Promise<void> {
    const ttl = userId ? AUTH_TTL : GUEST_TTL;
    cart.expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await this.toRedis(this.key(userId, sessionId), cart, ttl);
    if (userId) {
      this.saveToDb(cart, userId).catch((e) => this.logger.error(`Cart DB persist error: ${e.message}`));
    }
  }

  private async saveToDb(cart: CartData, userId: string): Promise<void> {
    let db = await this.cartRepo.findOne({ where: { userId } });
    if (!db) {
      db = await this.cartRepo.save(this.cartRepo.create({ userId, expiresAt: new Date(cart.expiresAt) }));
    }
    await this.itemRepo.delete({ cartId: db.id });
    if (cart.items.length) {
      await this.itemRepo.save(
        cart.items.map((i) => this.itemRepo.create({ cartId: db!.id, variantId: i.variantId, quantity: i.quantity, addedAt: new Date() })),
      );
    }
  }

  private async hydrateFromDb(cartId: string, userId: string, dbItems: CartItemEntity[]): Promise<CartData> {
    const items: CartItem[] = await Promise.all(
      dbItems.map(async (item) => {
        const v = await this.fetchVariant(item.variantId);
        return { id: item.id, variantId: item.variantId, quantity: item.quantity, variant: v, unitPrice: Number(v?.price ?? 0), totalPrice: Number(v?.price ?? 0) * item.quantity };
      }),
    );
    const cart: CartData = { id: cartId, userId, items, subtotal: 0, itemCount: 0, expiresAt: new Date(Date.now() + AUTH_TTL * 1000).toISOString() };
    this.calc(cart);
    return cart;
  }

  private async fetchVariant(variantId: string): Promise<any> {
    try {
      const res = await firstValueFrom(this.http.get(`${this.config.get('services.productServiceUrl')}/variants/${variantId}`));
      return res.data.data;
    } catch { return null; }
  }
}

// ── Controller ─────────────────────────────────────────────

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

// Imports needed at controller level
import { JwtAuthGuard, CurrentUser } from '@bazarbd/common';