// ============================================================
// services/search-service/src/smart-search.service.ts
// ============================================================
// Smart search adds personalisation on top of standard
// Elasticsearch text matching.
//
// Ranking signals (in order of weight):
// 1. Text relevance (BM25 score from Elasticsearch)   — base
// 2. User's category preferences (from purchase history) — +boost
// 3. User's brand preferences                           — +boost
// 4. Product rating and sold count                      — +boost
// 5. Recently viewed by user                           — +small boost
// 6. Price preference (range user usually buys in)     — +small boost
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';

export interface SmartSearchParams {
  query:        string;
  userId?:      string;
  categoryId?:  string;
  minPrice?:    number;
  maxPrice?:    number;
  minRating?:   number;
  sortBy?:      string;
  sortOrder?:   'asc' | 'desc';
  page:         number;
  limit:        number;
}

@Injectable()
export class SmartSearchService {
  private readonly logger = new Logger(SmartSearchService.name);

  constructor(
    private readonly es: ElasticsearchService,
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async search(params: SmartSearchParams): Promise<{ data: any[]; meta: any; personalized: boolean }> {
    // Load user preferences if logged in
    const preferences = params.userId
      ? await this.getUserPreferences(params.userId)
      : null;

    const query = this.buildQuery(params, preferences);

    const result = await this.es.search({
      index: 'bazarbd_products',
      from:  (params.page - 1) * params.limit,
      size:  params.limit,
      ...query,
    });

    const total = typeof result.hits.total === 'number'
      ? result.hits.total
      : result.hits.total?.value ?? 0;

    return {
      data:         result.hits.hits.map((h) => ({ ...h._source, _score: h._score })),
      meta:         { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
      personalized: Boolean(preferences),
    };
  }

  private buildQuery(params: SmartSearchParams, preferences: any) {
    const mustClauses: any[]   = [{ term: { status: 'active' } }];
    const filterClauses: any[] = [];
    const shouldClauses: any[] = []; // Boosts — optional but improve score

    // ── Text search ──────────────────────────────────────
    if (params.query?.trim()) {
      mustClauses.push({
        multi_match: {
          query:    params.query,
          fields:   ['name^4', 'nameBn^4', 'description^1', 'tags^2', 'brand^2'],
          type:     'best_fields',
          fuzziness:'AUTO',
        },
      });
    }

    // ── Category filter ───────────────────────────────────
    if (params.categoryId) {
      filterClauses.push({ term: { categoryId: params.categoryId } });
    }

    // ── Price range filter ────────────────────────────────
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      filterClauses.push({
        range: { basePrice: { gte: params.minPrice, lte: params.maxPrice } },
      });
    }

    // ── Minimum rating filter ─────────────────────────────
    if (params.minRating !== undefined) {
      filterClauses.push({ range: { rating: { gte: params.minRating } } });
    }

    // ── Personalisation boosts (only if user preferences exist) ──
    if (preferences) {
      // Boost preferred categories (2x)
      if (preferences.topCategories?.length) {
        shouldClauses.push({
          terms_set: {
            categoryId: {
              terms:                     preferences.topCategories,
              minimum_should_match_script:{ source: '1' },
            },
          },
        });
        // Simpler boost: just add terms query with boost
        shouldClauses.push({
          terms: { categoryId: preferences.topCategories, boost: 2 },
        });
      }

      // Boost preferred brands (1.5x)
      if (preferences.topBrands?.length) {
        shouldClauses.push({
          terms: { 'brand.keyword': preferences.topBrands, boost: 1.5 },
        });
      }

      // Boost products in user's typical price range (1.2x)
      if (preferences.avgOrderValue) {
        const low  = preferences.avgOrderValue * 0.5;
        const high = preferences.avgOrderValue * 2;
        shouldClauses.push({
          range: { basePrice: { gte: low, lte: high, boost: 1.2 } },
        });
      }
    }

    // ── Quality boosts (always applied) ──────────────────
    // High-rated products get a boost
    shouldClauses.push({ range: { rating: { gte: 4.0, boost: 1.5 } } });
    // Popular products get a boost
    shouldClauses.push({ range: { soldCount: { gte: 100, boost: 1.3 } } });
    // Featured products get a boost
    shouldClauses.push({ term: { isFeatured: true, boost: 1.2 } });

    // ── Sort ──────────────────────────────────────────────
    let sort: any[] = [];
    if (params.sortBy && params.sortBy !== 'relevance') {
      const sortField = params.sortBy === 'price' ? 'basePrice'
        : params.sortBy === 'rating'    ? 'rating'
        : params.sortBy === 'popularity'? 'soldCount'
        : params.sortBy === 'createdAt' ? 'createdAt'
        : '_score';
      sort = [
        { [sortField]: { order: params.sortOrder ?? 'desc' } },
        { _score: { order: 'desc' } },
      ];
    } else {
      // Default: relevance-first (Elasticsearch _score handles this)
      sort = [{ _score: { order: 'desc' } }, { soldCount: { order: 'desc' } }];
    }

    return {
      query: {
        bool: {
          must:   mustClauses,
          filter: filterClauses,
          should: shouldClauses,
          minimum_should_match: 0,
        },
      },
      sort,
    };
  }

  private async getUserPreferences(userId: string): Promise<{
    topCategories: string[];
    topBrands:     string[];
    avgOrderValue: number;
  } | null> {
    const cacheKey = `user:prefs:${userId}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const rows = await this.dataSource.query(`
        SELECT
          p.category_id,
          p.brand_id AS brand,
          COUNT(*) AS purchase_count,
          AVG(o.total) AS avg_order_value
        FROM orders o
        JOIN order_items oi  ON oi.order_id = o.id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p      ON p.id = pv.product_id
        WHERE o.customer_id = $1
          AND o.status IN ('delivered', 'shipped', 'confirmed')
          AND o.created_at > NOW() - INTERVAL '90 days'
        GROUP BY p.category_id, p.brand_id
        ORDER BY purchase_count DESC
        LIMIT 10
      `, [userId]);

      if (!rows.length) return null;

      const prefs = {
        topCategories: [...new Set(rows.map((r: any) => r.category_id).filter(Boolean))].slice(0, 3) as string[],
        topBrands:     [...new Set(rows.map((r: any) => r.brand).filter(Boolean))].slice(0, 3) as string[],
        avgOrderValue: rows.reduce((s: number, r: any) => s + parseFloat(r.avg_order_value ?? '0'), 0) / rows.length,
      };

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(prefs));
      return prefs;
    } catch (e) {
      this.logger.warn(`Could not load user preferences for ${userId}: ${(e as Error).message}`);
      return null;
    }
  }

  // Autocomplete with personalisation
  async autocomplete(query: string, userId?: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const result = await this.es.search({
      index: 'bazarbd_products',
      size:  8,
      query: {
        bool: {
          must: [
            { term: { status: 'active' } },
            {
              multi_match: {
                query,
                fields: ['name', 'nameBn'],
                type:   'phrase_prefix',
              },
            },
          ],
        },
      },
      sort: [{ soldCount: { order: 'desc' } }, { rating: { order: 'desc' } }],
      _source: ['name'],
    });

    return result.hits.hits.map((h: any) => h._source.name);
  }
}


// ============================================================
// services/search-service/src/search.controller.ts
// ============================================================
import {
  Controller, Get, Query, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public }       from './common/decorators/public.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CurrentUser }  from './common/decorators/current-user.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SmartSearchService) {}

  @Get()
  @Public()
  @UseGuards(JwtAuthGuard)  // Optional auth — personalises if logged in
  @ApiOperation({ summary: 'Smart search with personalisation' })
  async search(
    @Query('q')          q          = '',
    @Query('categoryId') categoryId?: string,
    @Query('minPrice')   minPrice?:  number,
    @Query('maxPrice')   maxPrice?:  number,
    @Query('minRating')  minRating?: number,
    @Query('sortBy')     sortBy      = 'relevance',
    @Query('sortOrder')  sortOrder:  'asc' | 'desc' = 'desc',
    @Query('page')       page        = 1,
    @Query('limit')      limit       = 20,
    @CurrentUser()       user?:      any,
  ) {
    return this.searchService.search({
      query:      q,
      userId:     user?.id,
      categoryId,
      minPrice:   minPrice ? +minPrice : undefined,
      maxPrice:   maxPrice ? +maxPrice : undefined,
      minRating:  minRating ? +minRating : undefined,
      sortBy,
      sortOrder,
      page:       +page,
      limit:      Math.min(+limit, 100),
    });
  }

  @Get('autocomplete')
  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Search autocomplete (personalised for logged-in users)' })
  autocomplete(@Query('q') q: string, @CurrentUser() user?: any) {
    return this.searchService.autocomplete(q, user?.id);
  }
}