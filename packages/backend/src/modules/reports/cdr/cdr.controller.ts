import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  Res,
  Header,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CdrService } from './cdr.service';
import { CdrQueryDto } from './dto/cdr-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../../cloud-admin/module-access.guard';
import { RequiresModule } from '../../cloud-admin/requires-module.decorator';

@Controller('reports/cdr')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('cdr')
export class CdrController {
  constructor(private readonly cdrService: CdrService) {}

  private viewer(req: { user?: { vpbx_user_uid: number; sub: number } }) {
    return {
      tenantId: req.user!.vpbx_user_uid,
      userId: req.user!.sub as number,
    };
  }

  @Get()
  findAll(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.findCalls(tenantId, query, userId);
  }

  @Get('stats')
  getStats(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getStats(tenantId, query, userId);
  }

  @Get('charts/by-hour')
  getByHour(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getByHour(tenantId, query, userId);
  }

  @Get('charts/by-day')
  getByDay(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getByDay(tenantId, query, userId);
  }

  @Get('charts/by-extension')
  getByExtension(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getByExtension(tenantId, query, userId);
  }

  @Get('charts/by-trunk')
  getByTrunk(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getByTrunk(tenantId, query, userId);
  }

  @Get('charts/by-disposition')
  getByDisposition(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getByDisposition(tenantId, query, userId);
  }

  @Get('charts/heatmap')
  getHeatmap(@Request() req: any, @Query() query: CdrQueryDto) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.getHeatmap(tenantId, query, userId);
  }

  @Get('export')
  async exportCsv(@Request() req: any, @Query() query: CdrQueryDto, @Res() res: Response) {
    const { tenantId, userId } = this.viewer(req);
    const rows = await this.cdrService.exportCalls(tenantId, query, userId);
    const delimiter = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Дата',
      'Кто звонил',
      'Куда',
      'Линия',
      'Статус',
      'Длительность',
      'Биллинг',
      'Направление',
    ].map(esc).join(delimiter);

    const lines = rows.map((r) =>
      [
        r.calldate,
        r.srcDisplay,
        r.dstDisplay,
        r.dialednum || '',
        r.disposition,
        r.duration,
        r.billsec,
        r.direction,
      ].map(esc).join(delimiter),
    );

    const body = '\uFEFF' + [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cdr_export_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(body);
  }

  @Get('by-uniqueid/:uniqueid')
  findByUniqueid(@Request() req: any, @Param('uniqueid') uniqueid: string) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.findByUniqueid(tenantId, uniqueid, userId);
  }

  /** HTML player popup (v3 play.php); audio uses absolute …/:uniqueid/play URL. */
  @Get('recording/:uniqueid')
  @Header('Content-Type', 'text/html; charset=utf-8')
  playRecordingPage(
    @Param('uniqueid') uniqueid: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    let streamSrc = this.cdrService.recordingPlayStreamPath(uniqueid, 'auth');
    if (token) {
      streamSrc += `?token=${encodeURIComponent(token)}`;
    }
    res.send(this.cdrService.renderRecordingPlayerHtml(streamSrc));
  }

  /** Stream MP3 from records_base_path (same-origin, v3 play.php behaviour). */
  @Get('recording/:uniqueid/play')
  playRecording(
    @Request() req: any,
    @Param('uniqueid') uniqueid: string,
    @Res() res: Response,
  ) {
    return this.cdrService.streamRecording(req.user.vpbx_user_uid, uniqueid, res, req);
  }

  @Get(':linkedid/legs')
  findLegs(@Request() req: any, @Param('linkedid') linkedid: string) {
    const { tenantId, userId } = this.viewer(req);
    return this.cdrService.findLegs(tenantId, linkedid, userId);
  }
}
