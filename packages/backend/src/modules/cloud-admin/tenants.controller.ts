import {
  Controller, Get, Post, Put, Patch, Param, Body,
  UseGuards, ParseIntPipe, Req, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { TenantsService, CreateTenantDto, UpdateTenantDto } from './tenants.service';

@ApiTags('Cloud Admin - Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ─── GET /cloud-admin/tenants ─────────────────────────────────────────────
  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.tenantsService.findAll({
      search,
      status,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  // ─── GET /cloud-admin/tenants/stats ──────────────────────────────────────
  @Get('stats')
  getStats() {
    return this.tenantsService.getStats();
  }

  // ─── GET /cloud-admin/tenants/:id ────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.findOne(id);
  }

  // ─── POST /cloud-admin/tenants — провизионирование ───────────────────────
  @Post()
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.tenantsService.provision(dto, req.user.sub);
  }

  // ─── PUT /cloud-admin/tenants/:id ────────────────────────────────────────
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
    @Req() req: any,
  ) {
    return this.tenantsService.update(id, dto, req.user.sub);
  }

  // ─── PATCH /cloud-admin/tenants/:id/suspend ───────────────────────────────
  @Patch(':id/suspend')
  suspend(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tenantsService.suspend(id, req.user.sub);
  }

  // ─── PATCH /cloud-admin/tenants/:id/activate ──────────────────────────────
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tenantsService.activate(id, req.user.sub);
  }

  // ─── POST /cloud-admin/tenants/:id/impersonate ────────────────────────────
  @Post(':id/impersonate')
  impersonate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tenantsService.impersonate(id, req.user.sub);
  }
}
