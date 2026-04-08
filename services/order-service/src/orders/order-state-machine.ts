import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@bazarbd/types';

const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]:          [OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_PENDING]:  [OrderStatus.CONFIRMED, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_FAILED]:   [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:        [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]:       [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]:           [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]:          [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED],
  [OrderStatus.DELIVERED]:        [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]:         [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]:        [],
  [OrderStatus.REFUNDED]:         [],
};

export function assertTransitionAllowed(current: OrderStatus, next: OrderStatus): void {
  const allowed = TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(
      `Cannot transition order from '${current}' to '${next}'. Allowed next states: [${allowed.join(', ') || 'none'}]`,
    );
  }
}
