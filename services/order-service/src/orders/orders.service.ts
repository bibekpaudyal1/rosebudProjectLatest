import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, PaymentMethod, UserRole, Cart } from '@bazarbd/types';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderRequestDto, UpdateOrderStatusDto } from './dto/order.dto';
import { assertTransitionAllowed } from './order-state-machine';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createFromCart(customerId: string, dto: CreateOrderRequestDto): Promise<Order> {
    const cartRes = await firstValueFrom(
      this.httpService.get(`${this.config.get('services.cartServiceUrl')}/cart`, {
        headers: { 'X-User-Id': customerId },
      }),
    );
    const cart: Cart = cartRes.data.data;
    if (!cart.items?.length) throw new BadRequestException('Cart is empty');

    const addrRes = await firstValueFrom(
      this.httpService.get(
        `${this.config.get('services.userServiceUrl')}/addresses/${dto.addressId}`,
        { headers: { 'X-User-Id': customerId } },
      ),
    );
    const address = addrRes.data.data;

    let discount = 0;
    if (dto.couponCode) {
      try {
        const couponRes = await firstValueFrom(
          this.httpService.post(
            `${this.config.get('services.promotionServiceUrl')}/coupons/validate`,
            { code: dto.couponCode, subtotal: cart.subtotal, customerId },
          ),
        );
        discount = couponRes.data.data.discountAmount;
      } catch {
        throw new BadRequestException(`Invalid coupon: ${dto.couponCode}`);
      }
    }

    let shippingFee = 60;
    try {
      const shipRes = await firstValueFrom(
        this.httpService.post(
          `${this.config.get('services.shippingServiceUrl')}/shipping/calculate`,
          { addressId: dto.addressId, items: cart.items },
        ),
      );
      shippingFee = shipRes.data.data.cheapestRate?.price ?? 60;
    } catch { /* use default */ }

    const total = Math.max(0, cart.subtotal + shippingFee - discount);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    try {
      const initialStatus = dto.paymentMethod === PaymentMethod.COD
        ? OrderStatus.CONFIRMED : OrderStatus.PAYMENT_PENDING;

      const order = qr.manager.create(Order, {
        customerId, addressId: dto.addressId, shippingAddress: address,
        status: initialStatus, paymentMethod: dto.paymentMethod,
        subtotal: cart.subtotal, shippingFee, discount,
        couponCode: dto.couponCode, total, notes: dto.notes,
      });
      const savedOrder = await qr.manager.save(order);

      const items = cart.items.map((ci: any) =>
        qr.manager.create(OrderItem, {
          orderId: savedOrder.id,
          sellerId: ci.variant?.product?.sellerId ?? '',
          variantId: ci.variantId,
          productSnapshot: {
            name: ci.variant?.product?.name,
            thumbnailUrl: ci.variant?.product?.thumbnailUrl,
            attributes: ci.variant?.attributes,
          },
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          totalPrice: ci.totalPrice,
        }),
      );
      await qr.manager.save(items);

      if (dto.couponCode) {
        await qr.manager.query(
          `UPDATE coupons SET used_count = used_count + 1 WHERE code = $1`,
          [dto.couponCode],
        );
      }

      await qr.commitTransaction();

      firstValueFrom(
        this.httpService.delete(`${this.config.get('services.cartServiceUrl')}/cart`, {
          headers: { 'X-User-Id': customerId },
        }),
      ).catch(() => {});

      this.eventEmitter.emit('order.created', {
        orderId: savedOrder.id, orderNumber: savedOrder.orderNumber,
        customerId, items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, sellerId: i.sellerId })),
        total, paymentMethod: dto.paymentMethod,
      });

      this.logger.log(`Order created: ${savedOrder.orderNumber}`);
      return await this.findById(savedOrder.id, customerId, UserRole.CUSTOMER);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findById(id: string, requesterId: string, role: UserRole): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR].includes(role);
    if (!isAdmin && order.customerId !== requesterId) throw new ForbiddenException('Access denied');
    return order;
  }

  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await this.orderRepo.findAndCount({
      where: { customerId }, relations: ['items'],
      order: { createdAt: 'DESC' }, take: limit, skip: (page - 1) * limit,
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findBySeller(sellerId: string, page = 1, limit = 20) {
    const [data, total] = await this.itemRepo.findAndCount({
      where: { sellerId }, order: { createdAt: 'DESC' },
      take: limit, skip: (page - 1) * limit,
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, requesterId: string, role: UserRole): Promise<Order> {
    const order = await this.findById(id, requesterId, role);
    assertTransitionAllowed(order.status, dto.status);

    const previousStatus = order.status;
    order.status = dto.status;
    if (dto.status === OrderStatus.CONFIRMED) order.confirmedAt = new Date();
    if (dto.status === OrderStatus.DELIVERED) order.deliveredAt = new Date();
    if (dto.status === OrderStatus.CANCELLED) order.cancelledAt = new Date();

    const saved = await this.orderRepo.save(order);

    await this.dataSource.query(
      `INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)`,
      [id, dto.status, dto.note ?? null, requesterId],
    );

    this.eventEmitter.emit('order.status_changed', {
      orderId: id, orderNumber: order.orderNumber,
      customerId: order.customerId, previousStatus, newStatus: dto.status,
    });

    return saved;
  }

  async cancel(id: string, requesterId: string, role: UserRole, reason?: string): Promise<Order> {
    const order = await this.findById(id, requesterId, role);
    if (role === UserRole.CUSTOMER && ![OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled at this stage. Please contact support.');
    }
    return this.updateStatus(id, { status: OrderStatus.CANCELLED, note: reason }, requesterId, role);
  }
}
