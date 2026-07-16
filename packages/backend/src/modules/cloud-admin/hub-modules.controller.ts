import {
  Body, Controller, Get, Param, Post, Put, Patch, Delete,
  UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { ModulesRegistryService } from './modules-registry.service';
import {
  CreateHubModuleDto,
  UpdateHubModuleDto,
  ReplaceHubModulePagesDto,
  ReorderHubModulesDto,
} from './dto/hub-module.dto';

/**
 * Platform Hub catalog CRUD — SuperAdmin only (D-21 / T-08-03).
 * Tenant APIs must not mutate membership.
 */
@ApiTags('Cloud Admin — Hub Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/hub-modules')
export class HubModulesController {
  constructor(private readonly modulesService: ModulesRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List Hub modules with page membership' })
  list() {
    return this.modulesService.listHubModules();
  }

  @Post()
  @ApiOperation({ summary: 'Create Hub module' })
  create(@Body() dto: CreateHubModuleDto) {
    return this.modulesService.createHubModule(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder Hub modules by code list' })
  reorder(@Body() dto: ReorderHubModulesDto) {
    return this.modulesService.reorderHubModules(dto.codes);
  }

  @Put(':code/pages')
  @ApiOperation({ summary: 'Replace page membership for a Hub module (D-21)' })
  replacePages(@Param('code') code: string, @Body() dto: ReplaceHubModulePagesDto) {
    return this.modulesService.replaceHubModulePages(code, dto.pages);
  }

  @Put(':code')
  @ApiOperation({ summary: 'Update Hub module metadata' })
  async update(@Param('code') code: string, @Body() dto: UpdateHubModuleDto) {
    const row = await this.modulesService.updateHubModule(code, dto);
    if (!row) throw new NotFoundException(`Hub module ${code} not found`);
    return row;
  }

  @Delete(':code')
  @ApiOperation({ summary: 'Delete Hub module (and its page membership)' })
  async remove(@Param('code') code: string) {
    await this.modulesService.deleteHubModule(code);
    return { success: true };
  }
}
