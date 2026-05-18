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

  @Get()
  findAll(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.findCalls(req.user.vpbx_user_uid, query);
  }

  @Get('stats')
  getStats(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getStats(req.user.vpbx_user_uid, query);
  }

  @Get('charts/by-hour')
  getByHour(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getByHour(req.user.vpbx_user_uid, query);
  }

  @Get('charts/by-day')
  getByDay(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getByDay(req.user.vpbx_user_uid, query);
  }

  @Get('charts/by-extension')
  getByExtension(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getByExtension(req.user.vpbx_user_uid, query);
  }

  @Get('charts/by-trunk')
  getByTrunk(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getByTrunk(req.user.vpbx_user_uid, query);
  }

  @Get('charts/by-disposition')
  getByDisposition(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getByDisposition(req.user.vpbx_user_uid, query);
  }

  @Get('charts/heatmap')
  getHeatmap(@Request() req: any, @Query() query: CdrQueryDto) {
    return this.cdrService.getHeatmap(req.user.vpbx_user_uid, query);
  }

  @Get('export')
  async exportCsv(@Request() req: any, @Query() query: CdrQueryDto, @Res() res: Response) {
    const rows = await this.cdrService.exportCalls(req.user.vpbx_user_uid, query);
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
    return this.cdrService.findByUniqueid(req.user.vpbx_user_uid, uniqueid);
  }

  /** HTML player popup (v3 play.php); audio loads from relative …/play. */
  @Get('recording/:uniqueid')
  @Header('Content-Type', 'text/html; charset=utf-8')
  playRecordingPage(
    @Param('uniqueid') uniqueid: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    const tokenQuery = token ? `token=${encodeURIComponent(token)}` : '';
    res.send(this.cdrService.renderRecordingPlayerHtml(uniqueid, tokenQuery));
  }

  /** Stream MP3 from records_base_path (same-origin, v3 play.php behaviour). */
  @Get('recording/:uniqueid/play')
  playRecording(
    @Request() req: any,
    @Param('uniqueid') uniqueid: string,
    @Res() res: Response,
  ) {
    return this.cdrService.streamRecording(req.user.vpbx_user_uid, uniqueid, res);
  }

  @Get(':linkedid/legs')
  findLegs(@Request() req: any, @Param('linkedid') linkedid: string) {
    return this.cdrService.findLegs(req.user.vpbx_user_uid, linkedid);
  }
}
