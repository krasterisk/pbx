import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AutodialDedupPolicy, IAutodialColumnMap } from '@krasterisk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { AutodialImportUploadDto } from './dto/autodial-import.dto';
import { AutodialWriteGuard } from './autodial-write.guard';
import { AutodialSchemaService } from './autodial-schema.service';
import { AutodialUiCommandService } from './autodial-ui-command.service';
import {
  CreateAutodialBaseDto,
  CreateAutodialContactDto,
  BulkDeleteAutodialBasesDto,
  UpdateAutodialBaseDto,
  UpdateAutodialContactDto,
} from './dto/autodial-base.dto';

type AuthedRequest = Request & { user: { vpbx_user_uid: number; sub?: number } };

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@UseGuards(JwtAuthGuard, ModuleAccessGuard, AutodialWriteGuard)
@RequiresModule('autodial')
@Controller('autodial/bases')
export class AutodialBasesController {
  constructor(
    private readonly basesService: AutodialBasesService,
    private readonly importService: AutodialImportService,
    private readonly schema: AutodialSchemaService,
    private readonly commands: AutodialUiCommandService,
  ) {}

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.basesService.findAll(req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: CreateAutodialBaseDto, @Headers('idempotency-key') key?: string) {
    if (key !== undefined) {
      const uid = await this.commands.run(req.user.vpbx_user_uid, req.user.sub, key, 'create_base', body,
        (transaction) => this.basesService.createInTransaction(req.user.vpbx_user_uid, body, transaction));
      return this.basesService.findOne(req.user.vpbx_user_uid, uid);
    }
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

  @Get(':base_uid/field-usage')
  fieldUsage(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number) {
    return this.schema.usage(req.user.vpbx_user_uid, baseUid);
  }

  @Get(':base_uid/import-runs')
  importRuns(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number) {
    return this.importService.listRuns(req.user.vpbx_user_uid, baseUid);
  }

  @Post(':base_uid/schema-preview')
  schemaPreview(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number, @Body() body: unknown) {
    return this.schema.preview(req.user.vpbx_user_uid, baseUid, body);
  }

  @Post(':base_uid/schema-apply')
  schemaApply(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number, @Body() body: unknown) {
    return this.schema.apply(req.user.vpbx_user_uid, req.user.sub, baseUid, body);
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
  async createContact(
    @Req() req: AuthedRequest,
    @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: CreateAutodialContactDto,
    @Headers('idempotency-key') key?: string,
  ) {
    if (key !== undefined) {
      const uid = await this.commands.run(req.user.vpbx_user_uid, req.user.sub, key, 'create_contact', { base_uid: baseUid, ...body },
        (transaction) => this.basesService.createContactInTransaction(req.user.vpbx_user_uid, baseUid, body, transaction));
      return this.basesService.findContact(req.user.vpbx_user_uid, baseUid, uid);
    }
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

  @Get(':base_uid/contacts/:contact_uid/history')
  contactHistory(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.basesService.contactHistory(req.user.vpbx_user_uid, baseUid, contactUid);
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
      invalid_optional_policy: body.invalid_optional_policy,
    });
  }

  @Post(':base_uid/import-validation')
  validateImport(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number, @Body() body: AutodialImportUploadDto) {
    return this.importService.importFile(req.user.vpbx_user_uid, baseUid, { buffer: this.decodeUpload(body.content_base64),
      filename: body.filename ?? 'upload', source: body.source ?? 'csv', profileUid: body.profile_uid,
      column_map: body.column_map, delimiter: body.delimiter, has_header: body.has_header, dedup_policy: body.dedup_policy,
      replace: body.replace, expected_revision: body.expected_revision, invalid_optional_policy: body.invalid_optional_policy, validation_only: true });
  }

  @Post(':base_uid/import-rejected')
  async rejectedImport(@Req() req: AuthedRequest, @Param('base_uid', ParseIntPipe) baseUid: number,
    @Body() body: AutodialImportUploadDto, @Res() res: Response) {
    const buffer = await this.importService.rejectedFile(req.user.vpbx_user_uid, baseUid, { buffer: this.decodeUpload(body.content_base64),
      filename: body.filename ?? 'upload', source: body.source ?? 'csv', profileUid: body.profile_uid,
      column_map: body.column_map, delimiter: body.delimiter, has_header: body.has_header, dedup_policy: body.dedup_policy,
      replace: body.replace, expected_revision: body.expected_revision, invalid_optional_policy: body.invalid_optional_policy });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="autodial-rejected-${baseUid}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store'); res.send(buffer);
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
