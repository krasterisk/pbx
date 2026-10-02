import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { CloudSettingsService } from './cloud-settings.service';
import { UpdateRegistrationPolicyDto } from './dto/registration-policy.dto';

@ApiTags('Cloud Admin - Registration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/registration-policy')
export class RegistrationPolicyController {
  constructor(private readonly settings: CloudSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Возможность самостоятельной регистрации организации' })
  async get(): Promise<{ registrationEnabled: boolean }> {
    return { registrationEnabled: await this.settings.isRegistrationEnabled() };
  }

  @Put()
  @ApiOperation({ summary: 'Включить или выключить регистрацию организаций' })
  async update(@Body() dto: UpdateRegistrationPolicyDto): Promise<{ registrationEnabled: boolean }> {
    await this.settings.setRegistrationEnabled(dto.registrationEnabled);
    return { registrationEnabled: await this.settings.isRegistrationEnabled() };
  }
}
