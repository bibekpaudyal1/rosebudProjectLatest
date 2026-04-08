// ============================================================
// services/recommendation-service/src/recommendation.service.ts
// ============================================================
// Two recommendation strategies running together:
//
// 1. COLLABORATIVE FILTERING — "customers like you also bought"
//    Finds users with similar purchase history → recommends
//    what those users bought that this user hasn't seen yet.
//    Runs as a batch job every 4 hours, stored in PostgreSQL.
//
// 2. CONTENT-BASED FILTERING — "similar products"
//    Uses product attributes (category, brand, price range, tags)
//    to find products similar to what the user is viewing.
//    Runs in real-time using Elasticsearch more-like-this queries.
//
// 3. TRENDING — most purchased in last 24h per category
//    Simple but effective for new users with no history.
// ============================================================
import {
  Injectable, Logger, OnModuleInit
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index
} from 'typeorm';

// ── Entities ──────────────────────────────────────────────

@Entity('user_recommendations')
export class UserRecommendation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id' }) @Index() userId: string;
  @Column({ name: 'product_id' }) productId: string;
  @Column({ type: 'float', default: 0 }) score: number;
  @Column({ default: 'collaborative' }) reason: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('product_views')
export class ProductView {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', nullable: true }) userId: string;
  @Column({ name: 'session_id', nullable: true }) sessionId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ name: 'viewed_at' }) viewedAt: Date;
}

// ── Service ────────────────────────────────────────────────

@Injectable()
export class RecommendationService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(UserRecommendation)
    private readonly recRepo: Repository<UserRecommendation>,
    @InjectRepository(ProductView)
    private readonly viewRepo: Repository<ProductView>,
    private readonly dataSource: DataSource,
    private readonly es: ElasticsearchService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    // Run initial recommendation batch on startup
    await this.runCollaborativeFiltering().catch((e) =>
      this.logger.warn(`Initial recommendation batch failed: ${e.message}`),
    );
  }

  // ──────────────────────────────────────────────────────────
  // 1. COLLABORATIVE FILTERING (batch, every 4 hours)
  // ──────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_4_HOURS)
  async runCollaborativeFiltering(): Promise<void> {
    this.logger.log('Running collaborative filtering batch...');

    // Step 1: Build user→product purchase matrix
    const purchases = await this.dataSource.query(`
      SELECT DISTINCT
        o.customer_id  AS user_id,
        oi.variant_id,
        pv.product_id,
        COUNT(*)        AS purchase_count
      FROM orders o
      JOIN order_items oi  ON oi.order_id = o.id
      JOIN product_variants pv ON pv.id = oi.variant_id
      WHERE o.status IN ('delivered', 'shipped', 'out_for_delivery')
        AND o.created_at > NOW() - INTERVAL '90 days'
      GROUP BY o.customer_id, oi.variant_id, pv.product_id
    `);

    if (!purchases.length) {
      this.logger.log('No purchase data yet — skipping collaborative filtering');
      return;
    }

    // Step 2: Build user similarity map (Jaccard similarity)
    // Group products bought by each user
    const userProducts = new Map<string, Set<string>>();
    for (const row of purchases) {
      if (!userProducts.has(row.user_id)) userProducts.set(row.user_id, new Set());
      userProducts.get(row.user_id)!.add(row.product_id);
    }

    const users = Array.from(userProducts.keys());
    const recommendations: Array<{ userId: string; productId: string; score: number }> = [];

    // For each user, find similar users and their products
    for (let i = 0; i < users.length; i++) {
      const userId      = users[i];
      const userProds   = userProducts.get(userId)!;
      const similarRecs = new Map<string, number>();

      for (let j = 0; j < users.length; j++) {
        if (i === j) continue;
        const otherUser  = users[j];
        const otherProds = userProducts.get(otherUser)!;

        // Jaccard similarity: |intersection| / |union|
        const intersection = new Set([...userProds].filter((p) => otherProds.has(p)));
        const union        = new Set([...userProds, ...otherProds]);
        const similarity   = intersection.size / union.size;

        if (similarity < 0.1) continue; // Not similar enough

        // Products the other user bought that this user hasn't
        for (const prod of otherProds) {
          if (!userProds.has(prod)) {
            similarRecs.set(prod, (similarRecs.get(prod) ?? 0) + similarity);
          }
        }
      }

      // Take top 20 recommendations per user
      const sorted = [...similarRecs.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      for (const [productId, score] of sorted) {
        recommendations.push({ userId, productId, score });
      }
    }

    // Step 3: Upsert recommendations
    if (recommendations.length) {
      // Clear old recommendations
      await this.dataSource.query(
        `DELETE FROM user_recommendations WHERE reason = 'collaborative'`,
      );

      // Insert new batch
      await this.dataSource.query(`
        INSERT INTO user_recommendations (user_id, product_id, score, reason)
        SELECT unnest($1::uuid[]), unnest($2::uuid[]), unnest($3::float[]), 'collaborative'
      `, [
        recommendations.map((r) => r.userId),
        recommendations.map((r) => r.productId),
        recommendations.map((r) => r.score),
      ]);
    }

    this.logger.log(`Collaborative filtering complete: ${recommendations.length} recommendations generated`);
  }

  // ──────────────────────────────────────────────────────────
  // 2. CONTENT-BASED FILTERING (real-time, Elasticsearch MLT)
  // ──────────────────────────────────────────────────────────
  async getSimilarProducts(productId: string, limit = 8): Promise<any[]> {
    const cacheKey = `similar:${productId}:${limit}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const result = await this.es.search({
        index: 'bazarbd_products',
        size:  limit + 1, // +1 to exclude the product itself
        query: {
          bool: {
            must: [
              { term: { status: 'active' } },
              {
                more_like_this: {
                  fields:   ['name', 'description', 'tags'],
                  like:     [{ _index: 'bazarbd_products', _id: productId }],
                  min_term_freq:  1,
                  min_doc_freq:   1,
                  max_query_terms:12,
                },
              },
            ],
            must_not: [
              { term: { _id: productId } }, // exclude the source product
            ],
          },
        },
      });

      const products = result.hits.hits.map((h) => h._source);

      // Cache for 30 minutes
      await this.redis.setex(cacheKey, 1800, JSON.stringify(products));
      return products;
    } catch (e) {
      this.logger.warn(`Similar products query failed: ${(e as Error).message}`);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────
  // 3. PERSONALISED RECOMMENDATIONS for a user
  // ──────────────────────────────────────────────────────────
  async getPersonalisedRecommendations(userId: string, limit = 10): Promise<any[]> {
    const cacheKey = `recs:user:${userId}:${limit}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Try collaborative first
    const collab = await this.dataSource.query(`
      SELECT ur.product_id, ur.score, p.name, p.thumbnail_url, p.base_price, p.rating, p.slug
      FROM user_recommendations ur
      JOIN products p ON p.id = ur.product_id
      WHERE ur.user_id    = $1
        AND ur.reason     = 'collaborative'
        AND p.status      = 'active'
      ORDER BY ur.score DESC
      LIMIT $2
    `, [userId, limit]);

    if (collab.length >= limit) {
      await this.redis.setex(cacheKey, 900, JSON.stringify(collab));
      return collab;
    }

    // Fall back to trending if not enough collaborative results
    const needed  = limit - collab.length;
    const existing = new Set(collab.map((r: any) => r.product_id));
    const trending = await this.getTrending(needed * 2);
    const filtered = trending.filter((p: any) => !existing.has(p.id)).slice(0, needed);
    const combined = [...collab, ...filtered];

    await this.redis.setex(cacheKey, 900, JSON.stringify(combined));
    return combined;
  }

  // ──────────────────────────────────────────────────────────
  // 4. TRENDING PRODUCTS (per category, last 24h)
  // ──────────────────────────────────────────────────────────
  async getTrending(limit = 10, categoryId?: string): Promise<any[]> {
    const cacheKey = `trending:${categoryId ?? 'all'}:${limit}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.dataSource.query(`
      SELECT
        p.id, p.name, p.slug, p.thumbnail_url, p.base_price, p.rating,
        p.sold_count, p.category_id,
        COUNT(oi.id) AS recent_sales
      FROM order_items oi
      JOIN orders o         ON o.id = oi.order_id
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p       ON p.id = pv.product_id
      WHERE o.created_at > NOW() - INTERVAL '24 hours'
        AND o.status NOT IN ('cancelled', 'payment_failed')
        AND p.status = 'active'
        ${categoryId ? `AND p.category_id = '${categoryId}'` : ''}
      GROUP BY p.id
      ORDER BY recent_sales DESC
      LIMIT $1
    `, [limit]);

    await this.redis.setex(cacheKey, 1800, JSON.stringify(rows));
    return rows;
  }

  // ──────────────────────────────────────────────────────────
  // 5. RECORD PRODUCT VIEW (for future recommendations)
  // ──────────────────────────────────────────────────────────
  async recordView(productId: string, userId?: string, sessionId?: string): Promise<void> {
    await this.viewRepo.save(
      this.viewRepo.create({
        productId,
        userId: userId ?? undefined,
        sessionId: sessionId ?? undefined,
        viewedAt: new Date(),
      }),
    );

    // Invalidate user's personalised recommendations cache
    if (userId) await this.redis.del(`recs:user:${userId}:10`);
  }
}


// ============================================================
// services/recommendation-service/src/recommendation.controller.ts
// ============================================================
import {
  Controller, Get, Post, Param, Query,
  UseGuards, ParseUUIDPipe, Headers
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public }      from './common/decorators/public.decorator';
import { JwtAuthGuard }from './common/guards/jwt-auth.guard';
import { CurrentUser } from './common/decorators/current-user.decorator';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recService: RecommendationService) {}

  @Get('for-you')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Personalised recommendations for logged-in user' })
  forYou(@CurrentUser() user: any, @Query('limit') limit = 10) {
    return this.recService.getPersonalisedRecommendations(user.id, +limit);
  }

  @Get('similar/:productId')
  @Public()
  @ApiOperation({ summary: 'Products similar to a given product' })
  similar(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('limit') limit = 8,
  ) {
    return this.recService.getSimilarProducts(productId, +limit);
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Trending products (last 24h)' })
  trending(
    @Query('limit') limit = 10,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.recService.getTrending(+limit, categoryId);
  }

  @Post('view/:productId')
  @Public()
  @ApiOperation({ summary: 'Record a product view for recommendation training' })
  recordView(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.recService.recordView(productId, user?.id, sessionId);
  }
}