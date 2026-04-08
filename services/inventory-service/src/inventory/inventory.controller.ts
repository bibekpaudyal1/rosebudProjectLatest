import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@bazarbd/types';
import { JwtAuthGuard, RolesGuard, Roles } from '@bazarbd/common';
import { InventoryService } from './inventory.service';
import { RestockDto, AdjustStockDto } from './dto/inventory.dto';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':variantId')
  @ApiOperation({ summary: 'Get stock level for a variant' })
  getStock(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventoryService.getStock(variantId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Get stock levels for multiple variants' })
  getBulkStock(@Body() body: { variantIds: string[] }) {
    return this.inventoryService.getBulkStock(body.variantIds);
  }

  @Post('restock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add stock for a variant (seller / admin)' })
  restock(@Body() dto: RestockDto) {
    return this.inventoryService.restock(dto);
  }

  @Post('adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manual stock adjustment (admin only)' })
  adjust(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('alerts/low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get low-stock items' })
  getLowStock(@Query('threshold') threshold?: number) {
    return this.inventoryService.getLowStockItems(threshold);
  }
}
