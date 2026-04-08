// packages/types/src/index.ts
// Shared TypeScript interfaces across all BazarBD services
// Import from '@bazarbd/types' in any service or app

// ============================================================
// ENUMS
// ============================================================

export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum SellerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum ProductStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_FAILED = 'payment_failed',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURN_REQUESTED = 'return_requested',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  BKASH = 'bkash',
  NAGAD = 'nagad',
  ROCKET = 'rocket',
  SSLCOMMERZ = 'sslcommerz',
  COD = 'cod',
  CARD = 'card',
}

export enum PaymentStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum ShipmentStatus {
  LABEL_CREATED = 'label_created',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}

export enum ShippingCarrier {
  PATHAO = 'pathao',
  REDX = 'redx',
  PAPERFLY = 'paperfly',
}

export enum NotificationChannel {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
}

// ============================================================
// BASE
// ============================================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// USER
// ============================================================

export interface User extends BaseEntity {
  phone?: string;
  email?: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface Address extends BaseEntity {
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  area?: string;
  district: string;
  division: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface CreateUserDto {
  phone?: string;
  email?: string;
  fullName: string;
  password?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  avatarUrl?: string;
}

// ============================================================
// AUTH
// ============================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;        // user id
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginDto {
  phone?: string;
  email?: string;
  password: string;
}

export interface RegisterDto {
  phone: string;
  fullName: string;
  password: string;
  otp: string;        // phone OTP required
}

export interface OAuthUserProfile {
  provider: 'google' | 'facebook';
  providerUid: string;
  email?: string;
  fullName: string;
  avatarUrl?: string;
}

// ============================================================
// SELLER
// ============================================================

export interface Seller extends BaseEntity {
  userId: string;
  shopName: string;
  shopSlug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  status: SellerStatus;
  rating: number;
  totalSales: number;
  commissionRate: number;
  approvedAt?: Date;
}

export interface CreateSellerDto {
  shopName: string;
  description?: string;
  nidNumber: string;
  tinNumber?: string;
}

// ============================================================
// PRODUCT
// ============================================================

export interface Category extends BaseEntity {
  parentId?: string;
  name: string;
  nameBn?: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  children?: Category[];
}

export interface ProductVariant extends BaseEntity {
  productId: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;   // {color: "Red", size: "XL"}
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface Product extends BaseEntity {
  sellerId: string;
  categoryId: string;
  brandId?: string;
  name: string;
  nameBn?: string;
  slug: string;
  description?: string;
  shortDesc?: string;
  basePrice: number;
  comparePrice?: number;
  thumbnailUrl?: string;
  status: ProductStatus;
  condition: 'new' | 'used' | 'refurbished';
  tags?: string[];
  attributes?: Record<string, unknown>;
  rating: number;
  reviewCount: number;
  soldCount: number;
  isFeatured: boolean;
  variants?: ProductVariant[];
  images?: ProductImage[];
  publishedAt?: Date;
}

export interface ProductImage extends BaseEntity {
  productId: string;
  url: string;
  altText?: string;
  displayOrder: number;
}

export interface CreateProductDto {
  categoryId: string;
  brandId?: string;
  name: string;
  nameBn?: string;
  description?: string;
  shortDesc?: string;
  basePrice: number;
  comparePrice?: number;
  condition?: 'new' | 'used' | 'refurbished';
  tags?: string[];
  attributes?: Record<string, unknown>;
  variants: CreateVariantDto[];
}

export interface CreateVariantDto {
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  comparePrice?: number;
  initialStock?: number;
}

// ============================================================
// INVENTORY
// ============================================================

export interface Inventory {
  id: string;
  variantId: string;
  quantity: number;
  reserved: number;
  available: number;  // computed: quantity - reserved
  lowStockThreshold: number;
  updatedAt: Date;
}

// ============================================================
// CART
// ============================================================

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  variant: ProductVariant & { product: Pick<Product, 'id' | 'name' | 'thumbnailUrl'> };
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  id: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  expiresAt: Date;
}

// ============================================================
// ORDER
// ============================================================

export interface Order extends BaseEntity {
  orderNumber: string;
  customerId: string;
  shippingAddress: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  shippingFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  notes?: string;
  items: OrderItem[];
  confirmedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
}

export interface OrderItem extends BaseEntity {
  orderId: string;
  sellerId: string;
  variantId: string;
  productSnapshot: {
    name: string;
    thumbnailUrl?: string;
    attributes: Record<string, string>;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: OrderStatus;
}

export interface CreateOrderDto {
  addressId: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  notes?: string;
}

// ============================================================
// PAYMENT
// ============================================================

export interface Payment extends BaseEntity {
  orderId: string;
  gateway: PaymentMethod;
  gatewayTxnId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gatewayResponse?: Record<string, unknown>;
  paidAt?: Date;
}

export interface InitiatePaymentDto {
  orderId: string;
  gateway: PaymentMethod;
  callbackUrl: string;
}

export interface BkashPaymentData {
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  merchantInvoiceNumber: string;
}

// ============================================================
// SHIPPING
// ============================================================

export interface Shipment extends BaseEntity {
  orderId: string;
  carrier: ShippingCarrier;
  trackingNumber?: string;
  labelUrl?: string;
  status: ShipmentStatus;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
}

export interface ShippingRate {
  carrier: ShippingCarrier;
  serviceType: string;
  price: number;
  estimatedDays: number;
  currency: string;
}

// ============================================================
// REVIEW
// ============================================================

export interface Review extends BaseEntity {
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title?: string;
  body?: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
}

export interface CreateReviewDto {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  body?: string;
  images?: string[];
}

// ============================================================
// KAFKA EVENTS
// ============================================================

export interface BaseEvent {
  eventId: string;
  eventType: string;
  eventVersion: string;
  timestamp: string;
  source: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

// User events
export interface UserRegisteredEvent extends BaseEvent {
  eventType: 'user.registered';
  payload: { userId: string; phone?: string; email?: string; fullName: string };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'user.updated';
  payload: { userId: string; changes: Partial<User> };
}

// Product events
export interface ProductCreatedEvent extends BaseEvent {
  eventType: 'product.created';
  payload: { productId: string; sellerId: string; name: string; categoryId: string };
}

export interface ProductUpdatedEvent extends BaseEvent {
  eventType: 'product.updated';
  payload: { productId: string; changes: Partial<Product> };
}

export interface ProductDeletedEvent extends BaseEvent {
  eventType: 'product.deleted';
  payload: { productId: string };
}

// Order events
export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'order.created';
  payload: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    items: Array<{ variantId: string; quantity: number; sellerId: string }>;
    total: number;
    paymentMethod: PaymentMethod;
  };
}

export interface OrderStatusChangedEvent extends BaseEvent {
  eventType: 'order.status_changed';
  payload: { orderId: string; orderNumber: string; customerId: string; previousStatus: OrderStatus; newStatus: OrderStatus };
}

// Payment events
export interface PaymentCompletedEvent extends BaseEvent {
  eventType: 'payment.completed';
  payload: { paymentId: string; orderId: string; amount: number; gateway: PaymentMethod };
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: 'payment.failed';
  payload: { paymentId: string; orderId: string; reason: string };
}

// Inventory events
export interface InventoryLowStockEvent extends BaseEvent {
  eventType: 'inventory.low_stock';
  payload: { variantId: string; productId?: string; sellerId?: string; remaining: number };
}

export interface InventoryOutOfStockEvent extends BaseEvent {
  eventType: 'inventory.out_of_stock';
  payload: { variantId: string };
}

export interface InventoryReservationFailedEvent extends BaseEvent {
  eventType: 'inventory.reservation_failed';
  payload: { orderId: string; reason: string };
}

// Shipment events
export interface ShipmentUpdatedEvent extends BaseEvent {
  eventType: 'shipment.updated';
  payload: { shipmentId: string; orderId: string; status: ShipmentStatus; trackingNumber?: string };
}

export type KafkaEvent =
  | UserRegisteredEvent
  | UserUpdatedEvent
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  | InventoryLowStockEvent
  | InventoryOutOfStockEvent
  | InventoryReservationFailedEvent
  | ShipmentUpdatedEvent;

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}