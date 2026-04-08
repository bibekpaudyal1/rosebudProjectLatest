import {
  IsString, IsOptional, IsEmail, IsMobilePhone,
  MinLength, MaxLength, Length, IsEnum
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+8801712345678', description: 'Bangladeshi mobile number' })
  @IsMobilePhone('bn-BD')
  phone: string;

  @ApiProperty({ enum: ['register', 'login', 'reset_password'] })
  @IsEnum(['register', 'login', 'reset_password'])
  purpose: 'register' | 'login' | 'reset_password';
}

export class RegisterDto {
  @ApiProperty({ example: '+8801712345678' })
  @IsMobilePhone('bn-BD')
  phone: string;

  @ApiProperty({ example: 'Rahim Uddin' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '123456', description: '6-digit SMS OTP' })
  @IsString()
  @Length(6, 6)
  otp: string;
}

export class LoginDto {
  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsOptional()
  @IsMobilePhone('bn-BD')
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsMobilePhone('bn-BD')
  phone: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsMobilePhone('bn-BD')
  phone: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
