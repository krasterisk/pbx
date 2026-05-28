import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { InjectModel } from '@nestjs/sequelize';
import { CcSubject } from './cc-subject.model';
import { CcDistrict } from './cc-district.model';

/**
 * ServiceRequestsController — REST API для обращений клиентов.
 *
 * Все эндпоинты защищены JWT и фильтруются по tenant (user_uid из токена).
 */
@Controller('service-requests')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('service_requests')
export class ServiceRequestsController {
  constructor(
    private readonly service: ServiceRequestsService,
    @InjectModel(CcSubject) private readonly ccSubjectModel: typeof CcSubject,
    @InjectModel(CcDistrict) private readonly ccDistrictModel: typeof CcDistrict,
  ) {}

  // ─── Справочники ───────────────────────────────────────────

  /** GET /service-requests/dictionaries/subjects — темы обращений */
  @Get('dictionaries/subjects')
  async getSubjects() {
    return this.ccSubjectModel.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
    });
  }

  /** GET /service-requests/dictionaries/districts — территориальные зоны и районы */
  @Get('dictionaries/districts')
  async getDistricts() {
    return this.ccDistrictModel.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
    });
  }

  // ─── CRUD заявок ───────────────────────────────────────────

  /** GET /service-requests — список обращений (с фильтрами и пагинацией) */
  @Get()
  async findAll(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('district') district?: string,
    @Query('topic') topic?: string,
    @Query('search') search?: string,
    @Query('territorial_zone') territorial_zone?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(req.user.vpbx_user_uid, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status,
      district,
      topic,
      search,
      territorial_zone,
      dateFrom,
      dateTo,
    });
  }

  /** GET /service-requests/stats — статистика по статусам */
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.service.getStatusStats(req.user.vpbx_user_uid);
  }

  /** GET /service-requests/:id — одно обращение */
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.vpbx_user_uid, parseInt(id, 10));
  }

  /** POST /service-requests — создать обращение */
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    // Автоматически заполняем оператора из JWT
    body.operator_id = req.user.uid || req.user.id;
    body.operator_name = req.user.name || req.user.username || '';
    return this.service.create(req.user.vpbx_user_uid, body);
  }

  /** PUT /service-requests/:id — обновить обращение */
  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user.vpbx_user_uid, parseInt(id, 10), body);
  }

  /** DELETE /service-requests/:id — удалить обращение */
  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.vpbx_user_uid, parseInt(id, 10));
  }
}
