# ============================================================
# BazarBD — Production Dockerfile for NestJS microservices
# Multi-stage build: deps → build → production
# Usage: docker build --build-arg SERVICE=user-service -t bazarbd/user-service .
# ============================================================

# ── Stage 1: Install all dependencies ─────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests first (leverages Docker layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/kafka-client/package.json ./packages/kafka-client/
COPY packages/common/package.json ./packages/common/

ARG SERVICE=user-service
COPY services/${SERVICE}/package.json ./services/${SERVICE}/

# Install all deps including dev (needed for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
ARG SERVICE=user-service
COPY packages ./packages
COPY services/${SERVICE} ./services/${SERVICE}
COPY turbo.json ./

# Build shared packages first, then the service
RUN pnpm --filter @bazarbd/types run build 2>/dev/null || true
RUN pnpm --filter @bazarbd/kafka-client run build 2>/dev/null || true
RUN pnpm --filter @bazarbd/common run build 2>/dev/null || true
RUN pnpm --filter @bazarbd/${SERVICE} run build

# ── Stage 3: Production image ──────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Install only production deps
RUN corepack enable && corepack prepare pnpm@9 --activate

ARG SERVICE=user-service
ENV SERVICE_NAME=${SERVICE}
ENV NODE_ENV=production

COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy built output
COPY --from=builder /app/services/${SERVICE}/dist ./dist
COPY --from=builder /app/packages ./packages

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --prod

# Switch to non-root user
USER nestjs

# Health check endpoint (each service exposes /health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4001}/health || exit 1

EXPOSE ${PORT:-4001}

CMD ["node", "dist/main.js"]


# ============================================================
# Dockerfile for Next.js apps (web / admin / seller)
# File: apps/web/Dockerfile
# ============================================================
FROM node:20-alpine AS nextjs-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/

ARG APP=web
COPY apps/${APP}/package.json ./apps/${APP}/

RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS nextjs-builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

ARG APP=web
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=nextjs-deps /app/node_modules ./node_modules
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}

# Standalone output for minimal Docker image
RUN echo '{"output":"standalone"}' > apps/${APP}/next.config.override.json

RUN pnpm --filter @bazarbd/types run build 2>/dev/null || true
RUN pnpm --filter @bazarbd/${APP} run build

FROM node:20-alpine AS nextjs-production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

ARG APP=web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=nextjs-builder /app/apps/${APP}/.next/standalone ./
COPY --from=nextjs-builder /app/apps/${APP}/.next/static     ./apps/${APP}/.next/static
COPY --from=nextjs-builder /app/apps/${APP}/public           ./apps/${APP}/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]