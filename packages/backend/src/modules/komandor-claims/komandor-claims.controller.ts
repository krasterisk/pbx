import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { KomandorClaimsService } from './komandor-claims.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';

@Controller('komandor-claims')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('komandor_claims')
export class KomandorClaimsController {
  constructor(private readonly service: KomandorClaimsService) {}

  @Get('dictionaries/stores')
  async getStores(@Request() req: any, @Query('q') q?: string) {
    return this.service.listStores(req.user.vpbx_user_uid, q);
  }

  @Get('dictionaries/dict')
  async getDict(@Query('kind') kind?: string) {
    return this.service.listDict(kind);
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string | string[],
    @Query('topic') topic?: string | string[],
    @Query('store') store?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(req.user.vpbx_user_uid, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status, topic, store, search, dateFrom, dateTo,
    });
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.service.getStatusStats(req.user.vpbx_user_uid);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.vpbx_user_uid, parseInt(id, 10));
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    body.operator_id = req.user.uid || req.user.id;
    body.operator_name = req.user.name || req.user.username || '';
    return this.service.create(req.user.vpbx_user_uid, body);
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    body.operator_name = body.operator_name || req.user.name || req.user.username || '';
    return this.service.update(req.user.vpbx_user_uid, parseInt(id, 10), body);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.vpbx_user_uid, parseInt(id, 10));
  }
}
