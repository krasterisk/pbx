import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TimeGroupsService } from './time-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('time-groups')
export class TimeGroupsController {
  constructor(private readonly timeGroupsService: TimeGroupsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.timeGroupsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.timeGroupsService.findOne(id, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.timeGroupsService.create(body, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.timeGroupsService.update(id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.timeGroupsService.remove(id, req.user.vpbx_user_uid);
    return { message: 'Time group deleted' };
  }

  @Post('bulk/delete')
  bulkRemove(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.timeGroupsService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }
}
