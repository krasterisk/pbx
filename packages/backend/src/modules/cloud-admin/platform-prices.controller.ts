import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { PlatformPricesService } from './platform-prices.service';
import {
  InsertUsageRateDto,
  PatchAiSkuPriceDto,
  PatchSubscriptionPriceDto,
} from './dto/platform-prices.dto';

@ApiTags('Cloud Admin — Platform Prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/platform-prices')
export class PlatformPricesController {
  constructor(private readonly prices: PlatformPricesService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription, SKU and usage list prices' })
  list() {
    return this.prices.list();
  }

  @Patch('subscriptions/:code')
  @ApiOperation({ summary: 'Update a modules_registry list price and period' })
  patchSubscription(@Param('code') code: string, @Body() dto: PatchSubscriptionPriceDto) {
    return this.prices.patchSubscription(code, dto);
  }

  @Patch('ai-skus')
  @ApiOperation({ summary: 'Revise a tenant-owned AI SKU monthly price' })
  patchAiSku(@Body() dto: PatchAiSkuPriceDto) {
    return this.prices.patchAiSku(dto);
  }

  @Post('usage-rates')
  @ApiOperation({ summary: 'Insert an immutable AI usage rate revision' })
  insertUsageRate(@Body() dto: InsertUsageRateDto) {
    return this.prices.insertUsageRate(dto);
  }
}
