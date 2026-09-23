import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AutodialDedupPolicy, IAutodialColumnMap } from '@krasterisk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { AutodialImportUploadDto } from './dto/autodial-import.dto';
import {
  CreateAutodialBaseDto,
  CreateAutodialContactDto,
  BulkDeleteAutodialBasesDto,
  UpdateAutodialBaseDto,
  UpdateAutodialContactDto,
} from './dto/autodial-base.dto';

type AuthedRequest = Request & { user: { vpbx_user_uid: number; sub?: number } };

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('autodial')
@Controller('autodial/bases')
export class AutodialBasesController {
  constructor(
    private readonly basesService: AutodialBasesService,
    private readonly importService: AutodialImportService,
  ) {}

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.basesService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateAutodialBaseDto) {
    return this.basesService.create(req.user.vpbx_user_uid, body);
  }

  @Post('bulk-delete')
  bulkRemove(@Req() req: AuthedRequest, @Body() body: BulkDeleteAutodialBasesDto) {
    return this.basesService.removeMany(req.user.vpbx_user_uid, body.uids);
  }

  @Get(':base_uid')
  findOne(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number) {
    return this.basesService.findOne(req.user.vpbx_user_uid, baseUid);
  }

  @Put(':base_uid')
  update(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: UpdateAutodialBaseDto,
  ) {
    return this.basesService.update(req.user.vpbx_user_uid, baseUid, body);
  }

  @Delete(':base_uid')
  async remove(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number) {
    await this.basesService.remove(req.user.vpbx_user_uid, baseUid);
    return { deleted: true };
  }

  // ── contacts ──────────────────────────────────────────────────────

  @Get(':base_uid/contacts')
  listContacts(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('q') q?: string,
  ) {
    return this.basesService.listContacts(req.user.vpbx_user_uid, baseUid, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
    });
  }

  @Post(':base_uid/contacts')
  createContact(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: CreateAutodialContactDto,
  ) {
    return this.basesService.createContact(req.user.vpbx_user_uid, baseUid, body);
  }

  @Get(':base_uid/contacts/:contact_uid')
  findContact(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number,
  ) {
    return this.basesService.findContact(req.user.vpbx_user_uid, baseUid, contactUid);
  }

  @Put(':base_uid/contacts/:contact_uid')
  updateContact(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number,
    @Body() body: UpdateAutodialContactDto,
  ) {
    return this.basesService.updateContact(req.user.vpbx_user_uid, baseUid, contactUid, body);
  }

  @Delete(':base_uid/contacts/:contact_uid')
  async deleteContact(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number,
  ) {
    await this.basesService.deleteContact(req.user.vpbx_user_uid, baseUid, contactUid);
    return { deleted: true };
  }

  // ── import ────────────────────────────────────────────────────────

  @Get(':base_uid/import-profiles')
  listProfiles(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number) {
    return this.importService.listProfiles(req.user.vpbx_user_uid, baseUid);
  }

  @Post(':base_uid/import-profiles')
  upsertProfile(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body()
    body: {
      uid?: number;
      name: string;
      source?: 'csv' | 'xlsx';
      delimiter?: string;
      encoding?: string;
      has_header?: boolean;
      column_map: IAutodialColumnMap[];
      dedup_policy?: AutodialDedupPolicy;
    },
  ) {
    return this.importService.upsertProfile(req.user.vpbx_user_uid, baseUid, body);
  }

  @Delete(':base_uid/import-profiles/:profile_uid')
  async deleteProfile(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Param('profile_uid', ParseIntPipe) profileUid: number,
  ) {
    await this.importService.deleteProfile(req.user.vpbx_user_uid, baseUid, profileUid);
    return { deleted: true };
  }

  /** Dry run: headers + sample rows so the wizard can map columns. */
  @Post(':base_uid/import-preview')
  async importPreview(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: AutodialImportUploadDto,
  ) {
    const base = await this.basesService.findOne(req.user.vpbx_user_uid, baseUid);
    const buffer = this.decodeUpload(body.content_base64);
    const preview = body.source === 'xlsx'
      ? await this.importService.previewXlsx(buffer, body)
      : await this.importService.previewCsv(buffer, body);
    return { ...preview, base_revision: base.revision };
  }

  @Post(':base_uid/import')
  importFile(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: AutodialImportUploadDto,
  ) {
    const buffer = this.decodeUpload(body.content_base64);
    return this.importService.importFile(req.user.vpbx_user_uid, baseUid, {
      buffer,
      filename: body.filename ?? 'upload',
      source: body.source ?? 'csv',
      profileUid: body.profile_uid,
      column_map: body.column_map,
      delimiter: body.delimiter,
      has_header: body.has_header,
      dedup_policy: body.dedup_policy,
      replace: body.replace,
      expected_revision: body.expected_revision,
    });
  }

  private decodeUpload(contentBase64: string): Buffer {
    if (!contentBase64) {
      throw new BadRequestException({
        code: 'AC_UPLOAD_EMPTY',
        message: 'content_base64 is required',
      });
    }
    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) {
      throw new BadRequestException({ code: 'AC_UPLOAD_EMPTY', message: 'Decoded upload is empty' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: 'AC_UPLOAD_TOO_LARGE',
        message: `Upload exceeds ${MAX_UPLOAD_BYTES} bytes`,
      });
    }
    return buffer;
  }
}
