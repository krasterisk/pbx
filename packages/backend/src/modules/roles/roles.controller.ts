import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesService } from './roles.service';
import { LoggerService } from '../logger/logger.service';

@ApiTags('Roles')
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly loggerService: LoggerService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.rolesService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.rolesService.findById(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() data: any, @Req() req: any) {
    data.vpbx_user_uid = req.user.vpbx_user_uid;
    const role = await this.rolesService.create(data);
    await this.loggerService.logAction(req.user.sub, 'create', 'role', role.id, req.user.vpbx_user_uid);
    return role;
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const role = await this.rolesService.update(id, req.user.vpbx_user_uid, data);
    await this.loggerService.logAction(req.user.sub, 'update', 'role', id, req.user.vpbx_user_uid);
    return role;
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const res = await this.rolesService.delete(id, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'delete', 'role', id, req.user.vpbx_user_uid);
    return res;
  }
}
