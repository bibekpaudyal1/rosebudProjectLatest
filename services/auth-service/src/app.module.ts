import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'bazarbd'),
        password: config.get('DB_PASSWORD', 'bazarbd_secret'),
        database: config.get('DB_NAME', 'bazarbd'),
        autoLoadEntities: true,
        synchronize: false, // Use init.sql for schema
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    // Redis
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: 100,
    }]),

    // Event emitter for internal events
    EventEmitterModule.forRoot(),

    // Feature modules
    AuthModule,
  ],
})
export class AppModule {}
