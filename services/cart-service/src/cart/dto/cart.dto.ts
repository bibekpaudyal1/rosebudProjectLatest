import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty() @IsUUID() variantId: string;
  @ApiProperty({ minimum: 1, maximum: 99 }) @IsInt() @Min(1) @Max(99) quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, maximum: 99, description: 'Set to 0 to remove item' })
  @IsInt() @Min(0) @Max(99) quantity: number;
}
