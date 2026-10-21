import {
  Controller,
  Optional,
  ServiceUnavailableException,
  Put,
  Body,
  Get,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../../cloud-admin/module-access.guard';
import { RequiresModule } from '../../cloud-admin/requires-module.decorator';
import type { JwtPayloadUser } from '../../auth/auth.service';
import { CallsPolicyDto } from './calls-policy.dto';
import { CallsQueryDto } from './calls-query.dto';
import { CallsService } from './calls.service';
import { CdrService } from '../cdr/cdr.service';
import { CallTranscriptService } from './call-transcript.service';
import { CallTextSearchDto } from './call-text-search.dto';
import { CallTextSearchService } from './call-text-search.service';
import { CallAnalysisService } from './call-analysis.service';
@Controller('reports/calls')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('cdr')
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly cdr: CdrService,
    @Optional() private readonly transcripts?: CallTranscriptService,
    @Optional() private readonly textSearch?: CallTextSearchService,
    @Optional() private readonly analysis?: CallAnalysisService,
  ) {}
  @Get() list(
    @Request() req: { user: JwtPayloadUser },
    @Query() query: CallsQueryDto,
  ) {
    return this.calls.list(req.user, query);
  }
  @Get('overview') overview(
    @Request() req: { user: JwtPayloadUser },
    @Query() query: CallsQueryDto,
  ) {
    return this.calls.overview(req.user, query);
  }
  @Get('search-text') searchText(@Request() req:{user:JwtPayloadUser},@Query() query:CallTextSearchDto) {
    if(!this.textSearch) throw new ServiceUnavailableException('Transcript search unavailable');
    return this.textSearch.search(req.user,query,query.phrase,query.mode);
  }
  @Get('policy') policy(@Request() req: { user: JwtPayloadUser }) {
    return this.calls.contactPolicy(req.user);
  }
  @Put('policy') setPolicy(
    @Request() req: { user: JwtPayloadUser },
    @Body() body: CallsPolicyDto,
  ) {
    return this.calls.setContactPolicy(req.user, body.windowHours);
  }
  @Get('attention') attention(
    @Request() req: { user: JwtPayloadUser },
    @Query() query: CallsQueryDto,
  ) {
    return this.calls.attention(req.user, query);
  }
  @Get('facets') facets(
    @Request() req: { user: JwtPayloadUser },
    @Query() query: CallsQueryDto,
  ) {
    return this.calls.facets(req.user, query);
  }
  @Get('export') async exportCsv(
    @Request() req: { user: JwtPayloadUser },
    @Query() query: CallsQueryDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="company-calls.csv"',
    );
    try {
      await this.calls.exportCsv(req.user, query, async (chunk) => {
        if (res.destroyed) return false;
        if (res.write(chunk)) return true;
        return new Promise<boolean>((resolve) => {
          const finish = (ready: boolean) => {
            res.off('drain', drain);
            res.off('close', close);
            resolve(ready);
          };
          const drain = () => finish(true);
          const close = () => finish(false);
          res.once('drain', drain);
          res.once('close', close);
        });
      });
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
      }
      throw error;
    }
    res.end();
  }
  @Get(':id/transcript') transcript(@Request() req: { user: JwtPayloadUser }, @Param('id') id: string, @Query('cursor') cursor?: string, @Query('segment') segment?:string) {
    if (!this.transcripts) throw new ServiceUnavailableException('Transcript reader unavailable');
    return this.transcripts.read(req.user,id,cursor,segment);
  }
  @Get(':id/analysis') callAnalysis(@Request() req:{user:JwtPayloadUser},@Param('id') id:string) {
    if (!this.analysis) throw new ServiceUnavailableException('Call analysis unavailable');
    return this.analysis.read(req.user,id);
  }
  @Get(':id') detail(
    @Request() req: { user: JwtPayloadUser },
    @Param('id') id: string,
  ) {
    return this.calls.detail(req.user, id);
  }
  @Get(':id/recordings/:recordingId') async recording(
    @Request() req: ExpressRequest & { user: JwtPayloadUser },
    @Param('id') id: string,
    @Param('recordingId') recordingId: string,
    @Res() res: Response,
  ) {
    await this.calls.authorizeRecording(req.user, id, recordingId);
    return this.cdr.streamRecording(
      req.user.vpbx_user_uid,
      recordingId,
      res,
      req,
    );
  }
}
