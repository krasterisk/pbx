import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { CloudSettingsService, SellerInfo } from './cloud-settings.service';

@ApiTags('Cloud Admin — Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/settings')
export class CloudSettingsController {
  constructor(private readonly settingsService: CloudSettingsService) {}

  /** GET /cloud-admin/settings/seller — Реквизиты поставщика */
  @Get('seller')
  @ApiOperation({ summary: 'Получить реквизиты поставщика для PDF документов' })
  getSellerInfo() {
    return this.settingsService.getSellerInfo();
  }

  /** PATCH /cloud-admin/settings/seller — Обновить реквизиты поставщика */
  @Patch('seller')
  @ApiOperation({ summary: 'Обновить реквизиты поставщика' })
  updateSellerInfo(@Body() body: Partial<SellerInfo>) {
    return this.settingsService.updateSellerInfo(body);
  }
}
