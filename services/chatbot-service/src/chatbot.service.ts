// ============================================================
// services/chatbot-service/src/chatbot.service.ts
// ============================================================
// AI customer support chatbot powered by the Anthropic Claude API.
// Handles: order tracking, product questions, return requests,
// payment issues, and general shopping help.
//
// Architecture:
// - Stateless API: conversation history sent with every request
// - Context injection: order/product data fetched and injected
//   into the system prompt so Claude has real data to answer with
// - Escalation: routes to human support when confidence is low
// - Languages: responds in Bengali or English based on user input
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import {
  IsString, IsArray, IsOptional, IsEnum, ValidateNested, ArrayMaxSize
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── DTOs ──────────────────────────────────────────────────

export class ChatMessage {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsEnum(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({ description: 'Latest message from the customer' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Conversation history (up to last 10 messages)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history?: ChatMessage[];

  @ApiPropertyOptional({ description: 'Order ID to load context for' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Product slug to load context for' })
  @IsOptional()
  @IsString()
  productSlug?: string;
}

export interface ChatResponse {
  message:    string;
  shouldEscalate: boolean;
  suggestedActions?: string[];
}

// ── Service ────────────────────────────────────────────────

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async chat(dto: ChatRequestDto, userId?: string): Promise<ChatResponse> {
    // Rate limiting: 20 messages per user per hour
    if (userId) {
      const rateKey = `chatbot:rate:${userId}`;
      const count   = await this.redis.incr(rateKey);
      if (count === 1) await this.redis.expire(rateKey, 3600);
      if (count > 20) {
        return {
          message: 'You have sent too many messages. Please try again in an hour or contact us at support@bazarbd.com',
          shouldEscalate: false,
        };
      }
    }

    // Load context (order data, product data)
    const context = await this.loadContext(dto, userId);

    // Build system prompt with BazarBD knowledge + context
    const systemPrompt = this.buildSystemPrompt(context, userId);

    // Build message history
    const messages: Array<{ role: string; content: string }> = [
      ...(dto.history?.slice(-10) ?? []),  // Last 10 messages for context window efficiency
      { role: 'user', content: dto.message },
    ];

    try {
      const response = await firstValueFrom(
        this.http.post(
          this.ANTHROPIC_API,
          {
            model:      'claude-sonnet-4-20250514',
            max_tokens: 800,
            system:     systemPrompt,
            messages,
          },
          {
            headers: {
              'x-api-key':         this.config.get<string>('anthropic.apiKey')!,
              'anthropic-version': '2023-06-01',
              'Content-Type':      'application/json',
            },
          },
        ),
      );

      const assistantMessage = response.data.content[0]?.text ?? '';
      const shouldEscalate   = this.detectEscalationNeeded(assistantMessage, dto.message);
      const suggestedActions = this.extractSuggestedActions(dto.message, context);

      // Log conversation for quality monitoring
      await this.logConversation(userId, dto.message, assistantMessage);

      return { message: assistantMessage, shouldEscalate, suggestedActions };
    } catch (e: any) {
      this.logger.error(`Claude API error: ${e.message}`);
      return {
        message:        'I\'m having trouble right now. Please contact our support team at support@bazarbd.com or call 01700-000000.',
        shouldEscalate: true,
      };
    }
  }

  private async loadContext(dto: ChatRequestDto, userId?: string): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {};

    // Load order data if orderId provided or detected in message
    const orderIdFromMessage = dto.orderId ?? this.extractOrderId(dto.message);
    if (orderIdFromMessage && userId) {
      const [order] = await this.dataSource.query(`
        SELECT
          o.order_number, o.status, o.total,
          o.payment_method, o.created_at, o.delivered_at,
          json_agg(json_build_object(
            'name',  oi.product_snapshot->>'name',
            'qty',   oi.quantity,
            'price', oi.total_price,
            'status',oi.status
          )) AS items,
          s.tracking_number, s.carrier, s.status AS shipment_status
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN shipments s    ON s.order_id  = o.id
        WHERE (o.id = $1 OR o.order_number = $1)
          AND o.customer_id = $2
        GROUP BY o.id, s.id
        LIMIT 1
      `, [orderIdFromMessage, userId]);

      if (order) context.order = order;
    }

    // Load user's recent orders summary
    if (userId) {
      const recentOrders = await this.dataSource.query(`
        SELECT order_number, status, total, created_at
        FROM orders
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 3
      `, [userId]);
      context.recentOrders = recentOrders;
    }

    // Load product context if slug provided
    if (dto.productSlug) {
      const [product] = await this.dataSource.query(`
        SELECT name, description, base_price, rating, review_count,
               (SELECT quantity - reserved FROM inventory i
                JOIN product_variants pv ON pv.id = i.variant_id
                WHERE pv.product_id = p.id LIMIT 1) AS stock
        FROM products p
        WHERE slug = $1 AND status = 'active'
        LIMIT 1
      `, [dto.productSlug]);
      if (product) context.product = product;
    }

    return context;
  }

  private buildSystemPrompt(context: Record<string, unknown>, userId?: string): string {
    const today = new Date().toLocaleDateString('en-BD', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka',
    });

    let prompt = `You are a helpful customer support assistant for BazarBD, Bangladesh's online marketplace.

Today's date: ${today}
Customer ID: ${userId ?? 'Guest (not logged in)'}

ABOUT BAZARBD:
- Online marketplace connecting buyers and sellers across Bangladesh
- Accepts bKash, Nagad, Rocket, credit/debit cards, and Cash on Delivery
- Delivery partners: Pathao, RedX, Paperfly
- Delivery time: 1-3 days within Dhaka, 3-7 days outside Dhaka
- Return policy: 7 days for most products, items must be unused and in original packaging
- Support: support@bazarbd.com, call 01700-000000 (9am-9pm)

RESPONSE GUIDELINES:
- Be warm, helpful, and concise. Keep responses under 150 words.
- Respond in the SAME LANGUAGE the customer uses (Bengali or English)
- If they write in Bengali, respond in Bengali
- If you cannot resolve an issue, say "আমি আপনাকে আমাদের সাপোর্ট টিমের সাথে সংযুক্ত করতে পারি" (I can connect you with our support team)
- Never make up order data — only use the data provided below
- For refund requests: explain the process but clarify only the support team can process them
- Be honest if you don't know something`;

    if (context.order) {
      const o = context.order as any;
      prompt += `\n\nCURRENT ORDER CONTEXT:
Order: ${o.order_number}
Status: ${o.status}
Total: ৳${o.total}
Payment: ${o.payment_method}
Placed: ${new Date(o.created_at).toLocaleDateString('en-BD')}
Items: ${JSON.stringify(o.items)}
${o.tracking_number ? `Tracking: ${o.tracking_number} via ${o.carrier}` : ''}`;
    }

    if (context.recentOrders && (context.recentOrders as any[]).length) {
      prompt += `\n\nCUSTOMER'S RECENT ORDERS:
${(context.recentOrders as any[]).map((o) => `- ${o.order_number}: ${o.status} (৳${o.total})`).join('\n')}`;
    }

    if (context.product) {
      const p = context.product as any;
      prompt += `\n\nPRODUCT CONTEXT:
${p.name} — ৳${p.base_price}
Rating: ${p.rating}/5 (${p.review_count} reviews)
Stock: ${p.stock > 0 ? `${p.stock} available` : 'Out of stock'}`;
    }

    return prompt;
  }

  private detectEscalationNeeded(response: string, userMessage: string): boolean {
    const escalationPhrases = [
      'support team', 'human agent', 'সাপোর্ট টিম', 'I cannot', 'I don\'t have access',
      'please contact', 'যোগাযোগ করুন', 'I\'m unable',
    ];
    const urgentPhrases = [
      'scam', 'fraud', 'legal', 'police', 'lawyer', 'court', 'complaint',
      'stolen', 'hacked', 'প্রতারণা', 'জরুরি',
    ];

    const combined = response.toLowerCase() + userMessage.toLowerCase();
    return (
      escalationPhrases.some((p) => combined.includes(p.toLowerCase())) ||
      urgentPhrases.some((p) => userMessage.toLowerCase().includes(p.toLowerCase()))
    );
  }

  private extractSuggestedActions(message: string, context: Record<string, unknown>): string[] {
    const actions: string[] = [];
    const lower = message.toLowerCase();

    if (lower.includes('return') || lower.includes('ফেরত'))   actions.push('Start Return Request');
    if (lower.includes('cancel') || lower.includes('বাতিল'))  actions.push('Cancel Order');
    if (lower.includes('track') || lower.includes('ট্র্যাক')) actions.push('Track My Order');
    if (lower.includes('refund') || lower.includes('রিফান্ড')) actions.push('Request Refund');
    if (lower.includes('payment') || lower.includes('পেমেন্ট')) actions.push('Retry Payment');

    if (context.order && !(context.order as any).tracking_number) {
      actions.push('Contact Seller');
    }

    return actions.slice(0, 3);
  }

  private extractOrderId(message: string): string | null {
    // Match pattern like BD-2026-00001234
    const match = message.match(/BD-\d{4}-\d{8}/i);
    return match ? match[0].toUpperCase() : null;
  }

  private async logConversation(userId: string | undefined, userMsg: string, botMsg: string): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO chatbot_logs (user_id, user_message, bot_response, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId ?? null, userMsg.slice(0, 500), botMsg.slice(0, 500)]).catch(() => {});
  }
}


// ============================================================
// services/chatbot-service/src/chatbot.controller.ts
// ============================================================
import {
  Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public }       from './common/decorators/public.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CurrentUser }  from './common/decorators/current-user.decorator';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  @Public()                     // guests can also use chatbot
  @UseGuards(JwtAuthGuard)      // but if logged in, user context is injected
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI support chatbot' })
  async chat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: any,
  ): Promise<ChatResponse> {
    return this.chatbotService.chat(dto, user?.id);
  }
}