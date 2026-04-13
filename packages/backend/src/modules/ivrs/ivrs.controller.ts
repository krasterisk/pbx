import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IvrsService } from './ivrs.service';
import { Ivr } from './ivr.model';

@Controller('ivrs')
@UseGuards(JwtAuthGuard)
export class IvrsController {
  constructor(private readonly ivrsService: IvrsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.ivrsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ivrsService.findOne(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() createDto: Partial<Ivr>, @Req() req: any) {
    return this.ivrsService.create(createDto, req.user.vpbx_user_uid);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: Partial<Ivr>, @Req() req: any) {
    return this.ivrsService.update(id, updateDto, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ivrsService.remove(id, req.user.vpbx_user_uid);
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.ivrsService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }
}
