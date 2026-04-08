import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UserRole } from '@bazarbd/types';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@bazarbd/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and browse products' })
  async search(@Query() query: ProductQueryDto) {
    return this.productsService.search(query);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions' })
  async autocomplete(@Query('q') q: string) {
    return this.productsService.autocomplete(q);
  }

  @Get(':slug/by-slug')
  @ApiOperation({ summary: 'Get product by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product (seller)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.sellerId ?? user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, user.sellerId ?? user.id, user.role, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish product' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.publish(id, user.sellerId ?? user.id, user.role);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish product' })
  async unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.unpublish(id, user.sellerId ?? user.id, user.role);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload product image' })
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.productsService.uploadImage(id, user.sellerId ?? user.id, user.role, { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname });
  }

  @Delete('images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product image' })
  async deleteImage(@Param('imageId', ParseUUIDPipe) imageId: string, @CurrentUser() user: any) {
    return this.productsService.deleteImage(imageId, user.sellerId ?? user.id, user.role);
  }
}
