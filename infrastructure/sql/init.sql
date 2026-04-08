-- ============================================================
-- BazarBD — Complete Database Schema
-- PostgreSQL 16
-- Run order matters: extensions → enums → tables → indexes
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram index for LIKE searches
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- composite GIN indexes

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'seller', 'moderator', 'admin', 'super_admin');
CREATE TYPE seller_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE product_status AS ENUM ('draft', 'pending_review', 'active', 'inactive', 'deleted');
CREATE TYPE order_status AS ENUM (
  'pending', 'payment_pending', 'payment_failed',
  'confirmed', 'processing', 'packed', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'return_requested',
  'returned', 'refunded'
);
CREATE TYPE payment_method AS ENUM ('bkash', 'nagad', 'rocket', 'sslcommerz', 'cod', 'card');
CREATE TYPE payment_status AS ENUM ('initiated', 'pending', 'completed', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE shipment_status AS ENUM ('label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned');
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'push', 'in_app');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');

-- ============================================================
-- USERS SERVICE
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           VARCHAR(20) UNIQUE,
  email           VARCHAR(255) UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'customer',
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Core user accounts. Phone is primary identifier for BD market.';

CREATE TABLE addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           VARCHAR(50) NOT NULL DEFAULT 'Home',   -- Home, Work, Other
  recipient_name  VARCHAR(255) NOT NULL,
  phone           VARCHAR(20) NOT NULL,
  line1           VARCHAR(255) NOT NULL,
  line2           VARCHAR(255),
  area            VARCHAR(100),
  district        VARCHAR(100) NOT NULL,
  division        VARCHAR(100) NOT NULL,
  postal_code     VARCHAR(20),
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUTH SERVICE
-- ============================================================

CREATE TABLE auth_credentials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_hash   VARCHAR(255),                         -- NULL for social-only accounts
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE oauth_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,                 -- 'google' | 'facebook'
  provider_uid    VARCHAR(255) NOT NULL,
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_uid)
);

CREATE TABLE auth_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   VARCHAR(512) NOT NULL UNIQUE,
  device_type     VARCHAR(50),                          -- 'web' | 'ios' | 'android'
  device_name     VARCHAR(255),
  ip_address      INET,
  user_agent      TEXT,
  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phone_otp (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           VARCHAR(20) NOT NULL,
  otp_hash        VARCHAR(255) NOT NULL,
  purpose         VARCHAR(50) NOT NULL,                 -- 'register' | 'login' | 'reset_password'
  attempts        INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SELLERS SERVICE
-- ============================================================

CREATE TABLE sellers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  shop_name       VARCHAR(255) NOT NULL,
  shop_slug       VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  nid_number      VARCHAR(50) UNIQUE,
  tin_number      VARCHAR(50),
  trade_license   VARCHAR(100),
  status          seller_status NOT NULL DEFAULT 'pending',
  rating          DECIMAL(3,2) NOT NULL DEFAULT 0,
  total_sales     INT NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,  -- percentage
  bank_account    JSONB DEFAULT '{}',                   -- encrypted bank details
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS SERVICE
-- ============================================================

CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  name_bn         VARCHAR(255),                         -- Bengali name
  slug            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT,
  image_url       TEXT,
  icon_url        TEXT,
  display_order   INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brands (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  logo_url        TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  category_id     UUID NOT NULL REFERENCES categories(id),
  brand_id        UUID REFERENCES brands(id),
  name            VARCHAR(500) NOT NULL,
  name_bn         VARCHAR(500),
  slug            VARCHAR(500) NOT NULL UNIQUE,
  description     TEXT,
  short_desc      VARCHAR(500),
  base_price      DECIMAL(12,2) NOT NULL,
  compare_price   DECIMAL(12,2),                        -- original price for showing discount
  thumbnail_url   TEXT,
  status          product_status NOT NULL DEFAULT 'draft',
  condition       VARCHAR(50) NOT NULL DEFAULT 'new',   -- 'new' | 'used' | 'refurbished'
  weight_grams    INT,
  tags            TEXT[],
  attributes      JSONB DEFAULT '{}',                   -- category-specific attributes
  rating          DECIMAL(3,2) NOT NULL DEFAULT 0,
  review_count    INT NOT NULL DEFAULT 0,
  sold_count      INT NOT NULL DEFAULT 0,
  view_count      INT NOT NULL DEFAULT 0,
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  alt_text        VARCHAR(255),
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             VARCHAR(100) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,               -- e.g. "Red / XL"
  attributes      JSONB NOT NULL DEFAULT '{}',          -- {color: "Red", size: "XL"}
  price           DECIMAL(12,2) NOT NULL,
  compare_price   DECIMAL(12,2),
  image_url       TEXT,
  barcode         VARCHAR(100),
  weight_grams    INT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY SERVICE
-- ============================================================

CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id          UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity            INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved            INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 10,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN inventory.reserved IS 'Stock held for pending orders. available = quantity - reserved';

CREATE TABLE inventory_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  type            VARCHAR(50) NOT NULL,                 -- 'restock' | 'sale' | 'reservation' | 'release' | 'adjustment'
  quantity_delta  INT NOT NULL,
  reference_id    UUID,                                 -- order_id or restock_id
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CART SERVICE (also stored in Redis; this is persistence)
-- ============================================================

CREATE TABLE carts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id      VARCHAR(255),                         -- for guest carts
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE cart_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, variant_id)
);

-- ============================================================
-- ORDERS SERVICE
-- ============================================================

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    VARCHAR(50) NOT NULL UNIQUE,          -- e.g. BD-2026-00001234
  customer_id     UUID NOT NULL REFERENCES users(id),
  address_id      UUID REFERENCES addresses(id),
  shipping_address JSONB NOT NULL,                      -- snapshot at time of order
  status          order_status NOT NULL DEFAULT 'pending',
  payment_method  payment_method NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  shipping_fee    DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  coupon_code     VARCHAR(50),
  total           DECIMAL(12,2) NOT NULL,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  confirmed_at    TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  seller_id           UUID NOT NULL REFERENCES sellers(id),
  variant_id          UUID NOT NULL REFERENCES product_variants(id),
  product_snapshot    JSONB NOT NULL,                   -- product name, image, attributes at time of order
  quantity            INT NOT NULL CHECK (quantity > 0),
  unit_price          DECIMAL(12,2) NOT NULL,
  total_price         DECIMAL(12,2) NOT NULL,
  status              order_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status          order_status NOT NULL,
  note            TEXT,
  changed_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE returns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  customer_id     UUID NOT NULL REFERENCES users(id),
  reason          TEXT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'requested',
  refund_amount   DECIMAL(12,2),
  images          TEXT[],
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS SERVICE
-- ============================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  gateway             payment_method NOT NULL,
  gateway_txn_id      VARCHAR(255),
  gateway_order_id    VARCHAR(255),
  amount              DECIMAL(12,2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'BDT',
  status              payment_status NOT NULL DEFAULT 'initiated',
  gateway_response    JSONB DEFAULT '{}',
  failure_reason      TEXT,
  paid_at             TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_refunds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES payments(id),
  amount          DECIMAL(12,2) NOT NULL,
  reason          TEXT,
  gateway_refund_id VARCHAR(255),
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SHIPPING SERVICE
-- ============================================================

CREATE TABLE shipments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  carrier         VARCHAR(50) NOT NULL,                 -- 'pathao' | 'redx' | 'paperfly'
  tracking_number VARCHAR(100),
  carrier_order_id VARCHAR(100),
  label_url       TEXT,
  status          shipment_status NOT NULL DEFAULT 'label_created',
  estimated_delivery TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status          VARCHAR(100) NOT NULL,
  location        VARCHAR(255),
  description     TEXT,
  carrier_timestamp TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROMOTIONS / COUPONS
-- ============================================================

CREATE TABLE coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(50) NOT NULL UNIQUE,
  description     TEXT,
  discount_type   discount_type NOT NULL,
  discount_value  DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_discount    DECIMAL(12,2),
  usage_limit     INT,
  used_count      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coupon_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id       UUID NOT NULL REFERENCES coupons(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  order_id        UUID REFERENCES orders(id),
  discount_applied DECIMAL(12,2) NOT NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)                            -- one use per customer
);

CREATE TABLE flash_sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  banner_url      TEXT,
  discount_type   discount_type NOT NULL,
  discount_value  DECIMAL(10,2) NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flash_sale_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id   UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  allocated_stock INT NOT NULL,
  sold_count      INT NOT NULL DEFAULT 0,
  sale_price      DECIMAL(12,2) NOT NULL,
  UNIQUE(flash_sale_id, variant_id)
);

-- ============================================================
-- NOTIFICATIONS SERVICE
-- ============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  channel         notification_channel NOT NULL,
  reference_type  VARCHAR(50),                          -- 'order' | 'payment' | 'product'
  reference_id    UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, channel, event_type)
);

-- ============================================================
-- REVIEWS SERVICE
-- ============================================================

CREATE TABLE reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  order_id            UUID REFERENCES orders(id),
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               VARCHAR(255),
  body                TEXT,
  images              TEXT[],
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved         BOOLEAN NOT NULL DEFAULT TRUE,
  helpful_count       INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, order_id, product_id)               -- one review per product per order
);

CREATE TABLE review_votes (
  reviewer_id     UUID NOT NULL REFERENCES users(id),
  review_id       UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  is_helpful      BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reviewer_id, review_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID REFERENCES users(id),
  actor_role      user_role,
  action          VARCHAR(100) NOT NULL,                -- e.g. 'order.cancel', 'product.delete'
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created ON users(created_at DESC);

-- Addresses
CREATE INDEX idx_addresses_user ON addresses(user_id);

-- Auth
CREATE INDEX idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_sessions_token ON auth_sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON auth_sessions(expires_at) WHERE is_revoked = FALSE;
CREATE INDEX idx_otp_phone ON phone_otp(phone, purpose) WHERE verified_at IS NULL;

-- Sellers
CREATE INDEX idx_sellers_user ON sellers(user_id);
CREATE INDEX idx_sellers_status ON sellers(status);
CREATE INDEX idx_sellers_slug ON sellers(shop_slug);

-- Products
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_products_rating ON products(rating DESC);
CREATE INDEX idx_products_sold ON products(sold_count DESC);
CREATE INDEX idx_products_price ON products(base_price);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_tags ON products USING gin(tags);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Product variants
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);

-- Inventory
CREATE INDEX idx_inventory_variant ON inventory(variant_id);
CREATE INDEX idx_inv_low_stock ON inventory(quantity) WHERE quantity <= low_stock_threshold;

-- Cart
CREATE INDEX idx_carts_user ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_carts_session ON carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_carts_expires ON carts(expires_at);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- Orders
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);

-- Payments
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gateway_txn ON payments(gateway_txn_id) WHERE gateway_txn_id IS NOT NULL;

-- Shipments
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_tracking_shipment ON shipment_tracking(shipment_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- Reviews
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(product_id, rating);

-- Audit
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Coupons
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active, starts_at, expires_at);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sellers_updated_at
  BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_variants_updated_at
  BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate order number: BD-YYYY-XXXXXXXX
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'BD-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
    LPAD(nextval('order_number_seq')::TEXT, 8, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TRIGGER trg_order_number
  BEFORE INSERT ON orders FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- Auto-update product rating when a review is added/updated
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET rating = (
    SELECT ROUND(AVG(rating)::NUMERIC, 2)
    FROM reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND is_approved = TRUE
  ),
  review_count = (
    SELECT COUNT(*)
    FROM reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND is_approved = TRUE
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();