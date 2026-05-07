import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UsePipes, ValidationPipe, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AmiService } from '../ami/ami.service';
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
    private readonly amiService: AmiService,
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
    const context = await this.findContext(contextUid, vpbxUserUid);
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
      // Expected: category or file doesn't exist yet
    }

    // Step 2: Create category
    try {
      await this.amiService.action({
        action: 'UpdateConfig',
        srcfilename: filename,
        dstfilename: filename,
        reload: 'no',
        'Action-000000': 'NewCat',
        'Cat-000000': tenantedContextName,
      });
    } catch (e: any) {
      this.logger.error(`Failed to create category [${tenantedContextName}]: ${e?.message || e}`);
      throw e;
    }

    // Step 3: Append lines in batches (AMI limit: ~32 headers per request)
    const BATCH_SIZE = 20;
    for (let batchStart = 0; batchStart < lines.length; batchStart += BATCH_SIZE) {
      const batch = lines.slice(batchStart, batchStart + BATCH_SIZE);
      const batchAction: Record<string, string> = {
        action: 'UpdateConfig',
        srcfilename: filename,
        dstfilename: filename,
        reload: 'no',
      };

      batch.forEach((line, idx) => {
        const paddedIdx = String(idx).padStart(6, '0');
        batchAction[`Action-${paddedIdx}`] = 'Append';
        batchAction[`Cat-${paddedIdx}`] = tenantedContextName;

        // Split on first '=>' or '=' to extract Var/Value for AMI
        const arrowPos = line.indexOf('=>');
        if (arrowPos !== -1) {
          batchAction[`Var-${paddedIdx}`] = line.substring(0, arrowPos).trim();
          batchAction[`Value-${paddedIdx}`] = `> ${line.substring(arrowPos + 2).trim()}`;
        } else {
          const eqPos = line.indexOf('=');
          if (eqPos !== -1) {
            batchAction[`Var-${paddedIdx}`] = line.substring(0, eqPos).trim();
            batchAction[`Value-${paddedIdx}`] = line.substring(eqPos + 1).trim();
          } else {
            batchAction[`Var-${paddedIdx}`] = line;
            batchAction[`Value-${paddedIdx}`] = '';
          }
        }
      });

      try {
        const res = await this.amiService.action(batchAction);
        if (res && res.response === 'Error') {
          this.logger.error(`AMI Append error for [${tenantedContextName}]: ${res.message || 'Unknown'}`);
          throw new Error(`AMI UpdateConfig Append failed: ${res.message || 'Unknown error'}`);
        }
      } catch (e: any) {
        this.logger.error(`Failed to apply dialplan for [${tenantedContextName}]: ${e?.message || e}`);
        throw e;
      }
    }

    this.logger.log(`Dialplan applied: [${tenantedContextName}] ${lines.length} lines`);

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
