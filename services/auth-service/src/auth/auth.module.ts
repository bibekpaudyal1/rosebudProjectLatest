import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthCredential } from './entities/auth-credential.entity';
import { AuthSession } from './entities/auth-session.entity';
import { PhoneOtp } from './entities/phone-otp.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthCredential, AuthSession, PhoneOtp]),
    JwtModule.register({}),
    HttpModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
