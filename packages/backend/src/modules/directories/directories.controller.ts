import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, Res,
  ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectoriesService } from './directories.service';
import type { DirectoryLookupResult } from './directories.service';

@UseGuards(JwtAuthGuard)
@Controller('directories')
export class DirectoriesController {
  constructor(private readonly directoriesService: DirectoriesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.directoriesService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.directoriesService.create(body, req.user.vpbx_user_uid);
  }

  @Post(':id/import-csv')
  importCsv(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { csv: string },
    @Req() req: any,
  ) {
    return this.directoriesService.importCsv(id, body.csv, req.user.vpbx_user_uid);
  }

  @Get(':id/export-csv')
  async exportCsv(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.directoriesService.exportCsv(id, req.user.vpbx_user_uid);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="directory_${id}.csv"`);
    res.send(csv);
  }

  @Post(':id/lookup-test')
  async lookupTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { key: string; fieldUids: number[] },
    @Req() req: any,
  ): Promise<DirectoryLookupResult> {
    const userUid = req.user.vpbx_user_uid;
    await this.directoriesService.findOne(id, userUid);
    return this.directoriesService.lookup({
      directoryUid: id,
      userUid,
      key: body.key,
      fieldUids: body.fieldUids,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.directoriesService.findOne(id, req.user.vpbx_user_uid);
  }

  /** Records are runtime data — do not re-apply dialplan on update. */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.directoriesService.update(id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.directoriesService.remove(id, req.user.vpbx_user_uid);
    return { message: 'Directory deleted' };
  }
}
