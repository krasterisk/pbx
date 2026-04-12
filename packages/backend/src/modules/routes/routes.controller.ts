import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AmiService } from '../ami/ami.service';
import { ContextsService } from '../contexts/contexts.service';

@UseGuards(JwtAuthGuard)
@Controller('routes')
export class RoutesController {
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
    const context = await this.contextsService.findOne(+contextUid, vpbxUserUid);
    const includes = await this.contextIncludesService.getIncludeNames(+contextUid, vpbxUserUid);
    const dialplan = await this.routesService.generateContextDialplan(
      +contextUid, vpbxUserUid, context.name, includes,
    );
    return { dialplan };
  }

  /**
   * Apply dialplan to Asterisk via AMI UpdateConfig.
   * This avoids direct filesystem access — all changes are pushed
   * through AMI's UpdateConfig action which modifies .conf files remotely.
   */
  @Post('apply/:contextUid')
  async applyDialplan(
    @Param('contextUid') contextUid: string,
    @Req() req: Request & { user: any },
  ) {
    const vpbxUserUid = req.user.vpbx_user_uid;
    const context = await this.contextsService.findOne(+contextUid, vpbxUserUid);
    const includes = await this.contextIncludesService.getIncludeNames(+contextUid, vpbxUserUid);
    const dialplan = await this.routesService.generateContextDialplan(
      +contextUid, vpbxUserUid, context.name, includes,
    );

    // Use AMI UpdateConfig to write dialplan file remotely
    const filename = `extensions_routes_${context.name}.conf`;

    try {
      // Step 1: Clear old config via AMI UpdateConfig (EmptyCat action)
      await this.amiService.action({
        action: 'UpdateConfig',
        srcfilename: filename,
        dstfilename: filename,
        action_000000: 'EmptyCat',
        cat_000000: context.name,
        reload: 'no',
      });
    } catch {
      // File may not exist yet — create it with NewCat
      try {
        await this.amiService.action({
          action: 'UpdateConfig',
          srcfilename: filename,
          dstfilename: filename,
          action_000000: 'NewCat',
          cat_000000: context.name,
          reload: 'no',
        });
      } catch (innerErr) {
        // If file doesn't exist at all, try creating via Append
      }
    }

    // Step 2: Write the new dialplan line-by-line via Append actions
    const lines = dialplan.split('\n').filter((l) => l.trim() && !l.startsWith('['));
    const updateAction: Record<string, string> = {
      action: 'UpdateConfig',
      srcfilename: filename,
      dstfilename: filename,
    };

    lines.forEach((line, idx) => {
      const paddedIdx = String(idx).padStart(6, '0');
      updateAction[`action_${paddedIdx}`] = 'Append';
      updateAction[`cat_${paddedIdx}`] = context.name;
      updateAction[`var_${paddedIdx}`] = line;
    });

    updateAction['reload'] = 'no';

    if (lines.length > 0) {
      await this.amiService.action(updateAction);
    }

    // Step 3: Reload dialplan
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
  create(
    @Body() body: any,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.create(body, req.user.vpbx_user_uid);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.duplicate(+id, req.user.vpbx_user_uid);
  }

  @Put('reorder')
  reorder(
    @Body() body: { contextUid: number; orderedIds: number[] },
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.reorder(body.contextUid, body.orderedIds, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.update(+id, body, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
  ) {
    return this.routesService.remove(+id, req.user.vpbx_user_uid);
  }
}
