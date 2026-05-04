import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NumbersService } from './numbers.service';
import { LoggerService } from '../logger/logger.service';

@ApiTags('Numbers')
@UseGuards(JwtAuthGuard)
@Controller('numbers')
export class NumbersController {
  constructor(
    private readonly numbersService: NumbersService,
    private readonly loggerService: LoggerService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.numbersService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.numbersService.findById(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() data: any, @Req() req: any) {
    data.user_uid = req.user.vpbx_user_uid;
    const item = await this.numbersService.create(data);
    await this.loggerService.logAction(req.user.sub, 'create', 'number', item.id, req.user.vpbx_user_uid);
    return item;
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const item = await this.numbersService.update(id, req.user.vpbx_user_uid, data);
    await this.loggerService.logAction(req.user.sub, 'update', 'number', id, req.user.vpbx_user_uid);
    return item;
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const res = await this.numbersService.delete(id, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'delete', 'number', id, req.user.vpbx_user_uid);
    return res;
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const deletedCount = await this.numbersService.bulkDelete(body.ids, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'bulk_delete', 'number', null, req.user.vpbx_user_uid, `Bulk deleted ${deletedCount} numbers`);
    return { deleted: deletedCount };
  }
}
