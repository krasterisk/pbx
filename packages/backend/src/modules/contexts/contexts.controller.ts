import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ContextsService } from './contexts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateContextDto, UpdateContextDto } from './context.dto';
import { ModuleRef } from '@nestjs/core';
import { RouteApplyService } from '../routes/route-apply.service';

@UseGuards(JwtAuthGuard)
@Controller('contexts')
export class ContextsController {
  constructor(private readonly contextsService: ContextsService, private readonly moduleRef: ModuleRef) {}

  private async apply(uid: number, user: { vpbx_user_uid: number; level?: number }) {
    try {
      const result = await this.moduleRef.get(RouteApplyService, { strict: false }).applyContext(uid, user.vpbx_user_uid, user.level === 1);
      return { dialplan_applied: result.success };
    } catch {
      // The database commit succeeded; return an explicit retryable apply state.
      return { dialplan_applied: false };
    }
  }

  @Post(':id/apply')
  applyContext(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.apply(+id, req.user);
  }

  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.contextsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.contextsService.findOne(+id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() body: CreateContextDto, @Req() req: Request & { user: any }) {
    const context = await this.contextsService.create(body, req.user.vpbx_user_uid);
    return { ...context.toJSON(), ...await this.apply(context.uid, req.user) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateContextDto, @Req() req: Request & { user: any }) {
    const context = await this.contextsService.update(+id, body, req.user.vpbx_user_uid);
    return { ...context.toJSON(), ...await this.apply(context.uid, req.user) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    const uid = +id;
    const tenant = req.user.vpbx_user_uid;
    const contexts = await this.contextsService.findAll(tenant);
    const removed = await this.contextsService.findOne(uid, tenant);
    const parents = contexts.filter((context) => context.include_uids.includes(uid));
    await this.contextsService.remove(uid, tenant);
    let applied = true;
    try { await this.moduleRef.get(RouteApplyService, { strict: false }).clearContext(removed.name, tenant); } catch { applied = false; }
    for (const parent of parents) if (!(await this.apply(parent.uid, req.user)).dialplan_applied) applied = false;
    return { deleted: true, dialplan_applied: applied };
  }
  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: Request & { user: any }) {
    const tenant = req.user.vpbx_user_uid;
    const contexts = await this.contextsService.findAll(tenant);
    const removed = contexts.filter((context) => body.ids.includes(context.uid));
    const parents = contexts.filter((context) => !body.ids.includes(context.uid) && context.include_uids.some((uid) => body.ids.includes(uid)));
    const result = await this.contextsService.bulkRemove(body.ids, tenant);
    let applied = true;
    for (const context of removed) {
      try { await this.moduleRef.get(RouteApplyService, { strict: false }).clearContext(context.name, tenant); } catch { applied = false; }
    }
    for (const parent of parents) if (!(await this.apply(parent.uid, req.user)).dialplan_applied) applied = false;
    return { ...result, dialplan_applied: applied };
  }
}
