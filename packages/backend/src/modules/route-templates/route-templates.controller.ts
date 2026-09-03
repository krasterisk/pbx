import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req,
  ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RouteTemplatesService } from './route-templates.service';
import { CreateRouteTemplateDto, UpdateRouteTemplateDto } from './dto/route-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('route-templates')
export class RouteTemplatesController {
  constructor(private readonly routeTemplatesService: RouteTemplatesService) {}

  @Get()
  findAll(@Req() req: { user: { vpbx_user_uid: number } }) {
    return this.routeTemplatesService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(
    @Body() body: CreateRouteTemplateDto,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.routeTemplatesService.create(body, req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.routeTemplatesService.findOne(id, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRouteTemplateDto,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    return this.routeTemplatesService.update(id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { vpbx_user_uid: number } },
  ) {
    await this.routeTemplatesService.remove(id, req.user.vpbx_user_uid);
    return { message: 'Route template deleted' };
  }
}
