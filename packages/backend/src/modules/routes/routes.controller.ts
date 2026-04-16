import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { Request } from 'express';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AmiService } from '../ami/ami.service';
import { ContextsService } from '../contexts/contexts.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/route-action.dto';

const USER_LEVEL_ADMIN = 1;

@UseGuards(JwtAuthGuard)
@Controller('routes')
export class RoutesController {
  private readonly logger = new Logger(RoutesController.name);

  constructor(
    private readonly routesService: RoutesService,
    private readonly contextIncludesService: ContextIncludesService,
    private readonly contextsService: ContextsService,
    private readonly amiService: AmiService,
  ) {}

  @Get()
  findAll(
    @Query('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.findAllByContext(+contextUid, req.user.vpbx_user_uid);
  }

  @Get('preview/:contextUid')
  async previewDialplan(
    @Param('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    const vpbxUserUid = req.user.vpbx_user_uid;
    const isAdmin = req.user.level === USER_LEVEL_ADMIN;
    const context = await this.contextsService.findOne(+contextUid, vpbxUserUid);
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
    const context = await this.contextsService.findOne(contextUid, vpbxUserUid);
    const includes = await this.contextIncludesService.getIncludeNames(contextUid, vpbxUserUid);
    const dialplan = await this.routesService.generateContextDialplan(
      contextUid, vpbxUserUid, context.name, includes, isAdmin,
    );

    const suffix = String(vpbxUserUid);
    const tenantedContextName = context.name.endsWith(suffix) ? context.name : `${context.name}${suffix}`;
    const filename = `krasterisk/routes/extensions_${tenantedContextName}.conf`;

    const lines = dialplan.split('\n')
      .map(l => l.trim())
      .filter((l) => l && !l.startsWith('[') && !l.startsWith(';'));

    this.logger.log(`Applying dialplan for [${tenantedContextName}]: ${lines.length} lines → ${filename}`);

    // Step 1: Delete existing category (silently fails if doesn't exist)
    try {
      await this.amiService.action({
        action: 'UpdateConfig',
        srcfilename: filename,
        dstfilename: filename,
        'Action-000000': 'DelCat',
        'Cat-000000': tenantedContextName,
        reload: 'no',
      });
    } catch (e) {
      // Expected to fail if category or file doesn't exist yet
      this.logger.debug(`DelCat skipped for ${tenantedContextName} (first time or missing file)`);
    }

    // Step 2: Create category + append all dialplan lines in one atomic action
    const updateAction: Record<string, string> = {
      action: 'UpdateConfig',
      srcfilename: filename,
      dstfilename: filename,
      reload: 'no',
      'Action-000000': 'NewCat',
      'Cat-000000': tenantedContextName,
    };

    lines.forEach((line, idx) => {
      const paddedIdx = String(idx + 1).padStart(6, '0'); // 0 = NewCat, 1+ = Append
      updateAction[`Action-${paddedIdx}`] = 'Append';
      updateAction[`Cat-${paddedIdx}`] = tenantedContextName;

      // Split on first '=>' or '=' to extract Var/Value for AMI
      const arrowPos = line.indexOf('=>');
      if (arrowPos !== -1) {
        updateAction[`Var-${paddedIdx}`] = line.substring(0, arrowPos).trim();
        updateAction[`Value-${paddedIdx}`] = `> ${line.substring(arrowPos + 2).trim()}`;
      } else {
        const eqPos = line.indexOf('=');
        if (eqPos !== -1) {
          updateAction[`Var-${paddedIdx}`] = line.substring(0, eqPos).trim();
          updateAction[`Value-${paddedIdx}`] = line.substring(eqPos + 1).trim();
        } else {
          updateAction[`Var-${paddedIdx}`] = line;
          updateAction[`Value-${paddedIdx}`] = '';
        }
      }
    });

    try {
      await this.amiService.action(updateAction);
      this.logger.log(`✅ Dialplan applied: [${tenantedContextName}] (${lines.length} lines)`);
    } catch (e) {
      this.logger.error(`❌ Failed to apply dialplan for [${tenantedContextName}]: ${e}`);
      throw e;
    }

    await this.amiService.command('dialplan reload');
    return { success: true, filename, linesApplied: lines.length };
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
    const route = await this.routesService.update(+id, body as any, req.user.vpbx_user_uid);
    try { await this._applyContextDialplan(route.context_uid, req.user); } catch (e) {}
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
