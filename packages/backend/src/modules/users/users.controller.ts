import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoggerService } from '../logger/logger.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly loggerService: LoggerService,
  ) {}

  @Get()
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.findById(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() data: any, @Req() req: any) {
    data.vpbx_user_uid = req.user.vpbx_user_uid;
    const user = await this.usersService.create(data);
    await this.loggerService.logAction(req.user.sub, 'create', 'user', user.uniqueid, req.user.vpbx_user_uid);
    return user;
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const user = await this.usersService.update(id, req.user.vpbx_user_uid, data);
    await this.loggerService.logAction(req.user.sub, 'update', 'user', id, req.user.vpbx_user_uid);
    return user;
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.usersService.delete(id, req.user.vpbx_user_uid);
    await this.loggerService.logAction(req.user.sub, 'delete', 'user', id, req.user.vpbx_user_uid);
  }
}
