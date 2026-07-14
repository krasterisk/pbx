import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, Query, Res,
  ParseIntPipe, UseGuards, HttpCode, Header, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhonebooksService } from './phonebooks.service';
import { RouteApplyService } from '../routes/route-apply.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';

const USER_LEVEL_ADMIN = 1;

@UseGuards(JwtAuthGuard)
@Controller('phonebooks')
export class PhonebooksController {
  private readonly logger = new Logger(PhonebooksController.name);

  constructor(
    private readonly phonebooksService: PhonebooksService,
    private readonly routeApplyService: RouteApplyService,
    private readonly dialplanApplyService: DialplanApplyService,
  ) {}

  @Get()
  findAll(@Req() req: any) {
    return this.phonebooksService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.phonebooksService.findOne(id, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.phonebooksService.create(body, req.user.vpbx_user_uid);
  }

  /**
   * Updates the phonebook, then — if the union of var-keys across its entries
   * changed — re-applies every route context that binds to it (D-18, Pitfall 6):
   * the per-binding dialplan hardcodes CUT() positions for the var-key set at
   * generation time, so a changed key set needs regenerated Set(PB_<key>=...) lines.
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userUid = req.user.vpbx_user_uid;
    const before = await this.phonebooksService.findOne(id, userUid);
    const beforeKeys = this.phonebooksService.collectAllVarKeys(before.entries || []);

    const pb = await this.phonebooksService.update(id, body, userUid);

    const afterKeys = this.phonebooksService.collectAllVarKeys(pb.entries || []);
    if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) {
      try {
        await this.routeApplyService.applyContextsForPhonebook(id, userUid, req.user.level === USER_LEVEL_ADMIN);
      } catch (e: any) {
        this.logger.error(`Failed to re-apply routes after phonebook ${id} var-key change: ${e?.message || e}`);
      }
    }
    return pb;
  }

  /**
   * Deletes the phonebook. Bindings are collected BEFORE the destroy (FK CASCADE
   * removes them), affected route contexts are re-applied afterwards, and the
   * now-orphaned pb_bind_* categories are explicitly DelCat'd (Pitfall 5).
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    const isAdmin = req.user.level === USER_LEVEL_ADMIN;
    const affected = await this.routeApplyService.getAffectedContexts(id, userUid);

    await this.phonebooksService.remove(id, userUid); // FK CASCADE removes bindings

    for (const contextUid of affected.contextUids) {
      try {
        await this.routeApplyService.applyContext(contextUid, userUid, isAdmin);
      } catch (e: any) {
        this.logger.error(`Failed to re-apply context ${contextUid} after phonebook ${id} delete: ${e?.message || e}`);
      }
    }
    if (affected.bindingUids.length > 0) {
      const orphanNames = affected.bindingUids.map((uid) => `pb_bind_${uid}_${userUid}`);
      try {
        await this.dialplanApplyService.deleteCategories(`krasterisk/phonebooks/pb_${userUid}.conf`, orphanNames, { reload: true });
      } catch (e: any) {
        this.logger.error(`Failed to clean up orphaned binding categories for phonebook ${id}: ${e?.message || e}`);
      }
    }

    return { message: 'Phonebook deleted' };
  }

  @Post('bulk/delete')
  bulkRemove(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.phonebooksService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }

  /**
   * CSV import endpoint.
   * Expects { csv: string } in body. Same var-key regen trigger as update() (D-18).
   */
  @Post(':id/import-csv')
  async importCsv(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { csv: string },
    @Req() req: any,
  ) {
    const userUid = req.user.vpbx_user_uid;
    const before = await this.phonebooksService.findOne(id, userUid);
    const beforeKeys = this.phonebooksService.collectAllVarKeys(before.entries || []);

    const result = await this.phonebooksService.importCsv(id, body.csv, userUid);

    const after = await this.phonebooksService.findOne(id, userUid);
    const afterKeys = this.phonebooksService.collectAllVarKeys(after.entries || []);
    if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) {
      try {
        await this.routeApplyService.applyContextsForPhonebook(id, userUid, req.user.level === USER_LEVEL_ADMIN);
      } catch (e: any) {
        this.logger.error(`Failed to re-apply routes after CSV import for phonebook ${id}: ${e?.message || e}`);
      }
    }
    return result;
  }

  /**
   * CSV export endpoint.
   * Returns CSV text as downloadable file.
   */
  @Get(':id/export-csv')
  async exportCsv(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.phonebooksService.exportCsv(id, req.user.vpbx_user_uid);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="phonebook_${id}.csv"`);
    res.send(csv);
  }

  /**
   * Demo lookup test (D-10): does a number match, and what PB_* vars would it set?
   * Tenant-checked (findOne throws NotFound for a foreign phonebook_uid) BEFORE
   * calling lookupNumber, which itself performs no tenant filtering (Pitfall 2 —
   * lookupNumber is shared with the internal, API-key-authenticated CURL endpoint).
   */
  @Post(':id/lookup-test')
  async lookupTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { number: string },
    @Req() req: any,
  ): Promise<{ matched: boolean; vars: Record<string, string> }> {
    await this.phonebooksService.findOne(id, req.user.vpbx_user_uid);
    const raw = await this.phonebooksService.lookupNumber(id, body.number);
    return this.parseLookupResult(raw);
  }

  /** Parse the pipe-delimited lookupNumber() result: "1|key1|val1|key2|val2|..." or "0". */
  private parseLookupResult(raw: string): { matched: boolean; vars: Record<string, string> } {
    const parts = raw.split('|');
    const matched = parts[0] === '1';
    const vars: Record<string, string> = {};
    if (matched) {
      for (let i = 1; i < parts.length; i += 2) {
        const key = parts[i];
        if (key) vars[key] = parts[i + 1] ?? '';
      }
    }
    return { matched, vars };
  }
}
