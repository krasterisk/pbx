import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { ServiceRequestsService } from './service-requests.service';
import { CcSubject } from './cc-subject.model';
import { CcDistrict } from './cc-district.model';

/**
 * Public (no-auth) Service Requests controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 *
 * All endpoints mirror the JWT-protected ServiceRequestsController,
 * but without @UseGuards(JwtAuthGuard) and with a fixed user_uid.
 */
@Controller('public/service-requests')
export class ServiceRequestsPublicController {
  private readonly userUid: number;

  constructor(
    private readonly service: ServiceRequestsService,
    private readonly configService: ConfigService,
    @InjectModel(CcSubject) private readonly ccSubjectModel: typeof CcSubject,
    @InjectModel(CcDistrict) private readonly ccDistrictModel: typeof CcDistrict,
  ) {
    this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
  }

  @Get('dictionaries/subjects')
  async getSubjects() {
    return this.ccSubjectModel.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC']] });
  }

  @Get('dictionaries/districts')
  async getDistricts() {
    return this.ccDistrictModel.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC']] });
  }

  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('district') district?: string,
    @Query('topic') topic?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(this.userUid, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status, district, topic, search,
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
