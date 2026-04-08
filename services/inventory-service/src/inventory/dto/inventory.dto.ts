import { IsNumber, IsString, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RestockDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class AdjustStockDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty({ description: 'Positive = add, negative = subtract' }) @IsNumber() quantityDelta: number;
  @ApiProperty() @IsString() reason: string;
}

export class ReserveStockDto {
  items: Array<{ variantId: string; quantity: number }>;
  orderId: string;
}
