import {
  IsString, IsOptional, IsNumber, IsArray, IsEnum,
  IsUUID, Min, IsBoolean, ValidateNested, IsObject, MaxLength, MinLength
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@bazarbd/types';

export class CreateVariantDto {
  @ApiProperty() @IsString() @MaxLength(100) sku: string;
  @ApiProperty() @IsString() @MaxLength(255) name: string;
  @ApiProperty() @IsObject() attributes: Record<string, string>;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) comparePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) initialStock?: number;
}

export class CreateProductDto {
  @ApiProperty() @IsUUID() categoryId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() brandId?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) nameBn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) shortDesc?: string;
  @ApiProperty() @IsNumber() @Min(0) basePrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) comparePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['new', 'used', 'refurbished']) condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @ApiProperty({ type: [CreateVariantDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) basePrice?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}

export class ProductQueryDto {
  @IsOptional() page?: number = 1;
  @IsOptional() limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() sellerId?: string;
  @IsOptional() minPrice?: number;
  @IsOptional() maxPrice?: number;
  @IsOptional() minRating?: number;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsBoolean() inStock?: boolean;
  @IsOptional() @IsString() sortBy?: string = 'createdAt';
  @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc' = 'desc';
}
