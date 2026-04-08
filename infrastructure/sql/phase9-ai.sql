-- ============================================================
-- Phase 9 AI Features — Database Tables
-- Run AFTER the main init.sql
-- ============================================================

-- Recommendation tables
CREATE TABLE IF NOT EXISTS user_recommendations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  product_id  UUID NOT NULL,
  score       FLOAT NOT NULL DEFAULT 0,
  reason      VARCHAR(50) NOT NULL DEFAULT 'collaborative',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_product_reason UNIQUE (user_id, product_id, reason)
);

CREATE TABLE IF NOT EXISTS product_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  session_id  VARCHAR(255),
  product_id  UUID NOT NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user    ON user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_score   ON user_recommendations(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_user      ON product_views(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_views_product   ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_date      ON product_views(viewed_at DESC);

-- Fraud detection tables
CREATE TABLE IF NOT EXISTS fraud_assessments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL,
  user_id      UUID NOT NULL,
  risk_score   INT NOT NULL,
  risk_level   VARCHAR(20) NOT NULL,
  signals      JSONB NOT NULL DEFAULT '{}',
  action       VARCHAR(20) NOT NULL DEFAULT 'allow',
  reviewed_by  UUID,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_order     ON fraud_assessments(order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_user      ON fraud_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_action    ON fraud_assessments(action);
CREATE INDEX IF NOT EXISTS idx_fraud_score     ON fraud_assessments(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_created   ON fraud_assessments(created_at DESC);

-- Chatbot logs (for quality monitoring and training)
CREATE TABLE IF NOT EXISTS chatbot_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID,
  user_message  TEXT NOT NULL,
  bot_response  TEXT NOT NULL,
  escalated     BOOLEAN NOT NULL DEFAULT FALSE,
  rating        SMALLINT,   -- 1-5, optional user feedback
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_user    ON chatbot_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_created ON chatbot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_escalated ON chatbot_logs(escalated) WHERE escalated = TRUE;