import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KomandorClaimsService } from './komandor-claims.service';

@Controller('public/komandor-claims')
export class KomandorClaimsPublicController {
  private readonly userUid: number;

  constructor(
    private readonly service: KomandorClaimsService,
    config: ConfigService,
  ) {
    this.userUid = Number(config.get('DEFAULT_VPBX_USER_UID', '1'));
  }

  @Get('dictionaries/stores')
  async getStores(@Query('q') q?: string) {
    return this.service.listStores(this.userUid, q);
  }

  @Get('dictionaries/dict')
  async getDict(@Query('kind') kind?: string) {
    return this.service.listDict(kind);
  }

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string | string[],
    @Query('topic') topic?: string | string[],
    @Query('store') store?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(this.userUid, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status, topic, store, search, dateFrom, dateTo,
    });
  }

  @Get('stats')
  async getStats() {
    return this.service.getStatusStats(this.userUid);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(this.userUid, parseInt(id, 10));
  }

  @Post()
  async create(@Body() body: any) {
    return this.service.create(this.userUid, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(this.userUid, parseInt(id, 10), body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(this.userUid, parseInt(id, 10));
  }
}
