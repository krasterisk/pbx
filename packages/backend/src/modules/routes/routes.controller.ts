import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UsePipes, ValidationPipe, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { RouteApplyService } from './route-apply.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Context } from '../contexts/context.model';
import { CreateRouteDto, UpdateRouteDto } from './dto/route-action.dto';

const USER_LEVEL_ADMIN = 1;

@UseGuards(JwtAuthGuard)
@Controller('routes')
export class RoutesController {
  private readonly logger = new Logger(RoutesController.name);

  constructor(
    private readonly routesService: RoutesService,
    private readonly contextIncludesService: ContextIncludesService,
    @InjectModel(Context) private readonly contextModel: typeof Context,
    private readonly routeApplyService: RouteApplyService,
  ) {}

  private async findContext(contextUid: number, vpbxUserUid: number): Promise<Context> {
    const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: vpbxUserUid } });
    if (!context) throw new NotFoundException('Context not found');
    return context;
  }

  @Get()
  findAll(
    @Query('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    const userUid = req.user.vpbx_user_uid;
    if (contextUid) {
      return this.routesService.findAllByContext(+contextUid, userUid);
    }
    return this.routesService.findAll(userUid);
  }

  @Get('preview/:contextUid')
  async previewDialplan(
    @Param('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    const vpbxUserUid = req.user.vpbx_user_uid;
    const isAdmin = req.user.level === USER_LEVEL_ADMIN;
    const context = await this.findContext(+contextUid, vpbxUserUid);
    const includes = await this.contextIncludesService.getIncludeNames(+contextUid, vpbxUserUid);
    const dialplan = await this.routesService.generateContextDialplan(
      +contextUid, vpbxUserUid, context.name, includes, isAdmin,
    );
    return { dialplan };
  }

  @Post('apply/:contextUid')
  async applyDialplan(
    @Param('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    return this._applyContextDialplan(+contextUid, req.user);
  }

  private async _applyContextDialplan(contextUid: number, user: any) {
    const vpbxUserUid = user.vpbx_user_uid;
    const isAdmin = user.level === USER_LEVEL_ADMIN;
    return this.routeApplyService.applyContext(contextUid, vpbxUserUid, isAdmin);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.findOne(+id, req.user.vpbx_user_uid);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() body: CreateRouteDto,
    @Req() req: Request & { user: any },
  ) {
    const route = await this.routesService.create(body as any, req.user.vpbx_user_uid);
    try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e) {}
    return route;
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    const route = await this.routesService.duplicate(+id, req.user.vpbx_user_uid);
    try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e) {}
    return route;
  }

  @Put('reorder')
  async reorder(
    @Body() body: { contextUid: number; orderedIds: number[] },
    @Req() req: Request & { user: any },
  ) {
    await this.routesService.reorder(body.contextUid, body.orderedIds, req.user.vpbx_user_uid);
    try { await this._applyContextDialplan(body.contextUid, req.user); } catch (e) {}
    return { success: true };
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateRouteDto,
    @Req() req: Request & { user: any },
  ) {
    const userUid = req.user.vpbx_user_uid;
    // Remember old context_uid before update (for regenerating old context)
    const oldRoute = await this.routesService.findOne(+id, userUid);
    const oldContextUid = oldRoute.context_uid;

    const route = await this.routesService.update(+id, body as any, userUid);

    // Regenerate new context dialplan
    try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e: any) {
      this.logger.error(`Failed to apply dialplan for new context ${route.context_uid}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
    // If context changed — also regenerate old context (to remove the route)
    if (oldContextUid !== route.context_uid) {
      try { await this._applyContextDialplan(oldContextUid, req.user); } catch (e: any) {
        this.logger.error(`Failed to apply dialplan for old context ${oldContextUid}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      }
    }
    return route;
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    const route = await this.routesService.findOne(+id, req.user.vpbx_user_uid).catch(() => null);
    await this.routesService.remove(+id, req.user.vpbx_user_uid);
    if (route) {
      try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e) {}
    }
    return { success: true };
  }

  @Post('bulk/delete')
  async bulkDelete(
    @Body() body: { ids: number[] },
    @Req() req: Request & { user: any },
  ) {
    if (!body.ids || body.ids.length === 0) return { deleted: 0 };
    const userUid = req.user?.vpbx_user_uid ?? 0;
    const route = await this.routesService.findOne(body.ids[0], userUid).catch(() => null);
    const result = await this.routesService.bulkRemove(body.ids, userUid);
    if (route) {
      try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e) {}
    }
    return result;
  }
}
