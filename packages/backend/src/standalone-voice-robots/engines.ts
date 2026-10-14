import { BadRequestException, Body, Controller, Delete, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SttEngine } from '../modules/stt-engines/stt-engine.model';
import { TtsEngine } from '../modules/tts-engines/tts-engine.model';
import { decryptSecret, encryptSecret } from '../modules/ai-connectivity/secret-cipher.util';
import { robotTenant, StandaloneRobotGuard, StandaloneRobotRequest } from './access';

type EngineKind = 'stt' | 'tts';
type EngineRow = SttEngine | TtsEngine;

@Injectable()
export class StandaloneSpeechEngines {
  constructor(
    @InjectModel(SttEngine) private readonly stt: typeof SttEngine,
    @InjectModel(TtsEngine) private readonly tts: typeof TtsEngine,
  ) {}
  private model(kind: string): typeof SttEngine {
    kind = kind.replace(/-engines$/, '');
    if (kind !== 'stt' && kind !== 'tts') throw new BadRequestException('Invalid engine kind');
    return (kind === 'stt' ? this.stt : this.tts) as typeof SttEngine;
  }
  async findAll(tenant: number, kind: EngineKind) {
    return (await this.list(kind, tenant)).map(row => this.publicRow(row));
  }
  async list(kind: string, tenant: number): Promise<EngineRow[]> {
    return this.model(kind).findAll({ where: { user_uid: tenant }, order: [['uid', 'DESC']] });
  }
  async find(kind: string, uid: number, tenant: number): Promise<EngineRow> {
    const row = await this.model(kind).findOne({ where: { uid, user_uid: tenant } });
    if (!row) throw new BadRequestException('Engine not found');
    return row;
  }
  async loadSpeechEngine(tenant: number, uid: number, kind: EngineKind) {
    const row = await this.find(kind, uid, tenant);
    const headers = row.custom_headers?.encrypted;
    return { ...row.toJSON(), token: row.token ? decryptSecret(row.token) : '', settings: row.settings || {},
      custom_headers: headers ? JSON.parse(decryptSecret(headers)) : row.custom_headers || {} };
  }
  publicRow(row: EngineRow) {
    return { ...row.toJSON(), token: '', has_token: !!row.token, custom_headers: {} };
  }
  async save(kind: string, tenant: number, body: Record<string, unknown>, uid?: number) {
    const values: Record<string, unknown> = {};
    for (const key of ['name', 'type', 'settings', 'custom_url', 'auth_mode']) {
      if (body[key] !== undefined) values[key] = body[key];
    }
    if (typeof body.token === 'string' && body.token) values.token = encryptSecret(body.token);
    // Encrypt custom auth headers too; keep the legacy model column but never return them.
    if (body.custom_headers && Object.keys(body.custom_headers as object).length) {
      values.custom_headers = { encrypted: encryptSecret(JSON.stringify(body.custom_headers)) };
    }
    if (!uid && (typeof values.name !== 'string' || !values.name.trim())) throw new BadRequestException('Name required');
    const supportedTypes = kind.replace(/-engines$/, '') === 'tts' ? ['yandex'] : ['yandex', 'custom'];
    if (values.type !== undefined && !supportedTypes.includes(String(values.type))) throw new BadRequestException('Unsupported standalone engine type');
    const row = uid ? await this.find(kind, uid, tenant) : null;
    return this.publicRow(row ? await row.update(values) : await this.model(kind).create({ ...values, user_uid: tenant }));
  }
  async remove(kind: string, tenant: number, uids: number[]) {
    if (!uids.length || uids.some(uid => !Number.isSafeInteger(uid) || uid <= 0)) throw new BadRequestException('Invalid IDs');
    return { deleted: await this.model(kind).destroy({ where: { uid: uids, user_uid: tenant } }) };
  }
}

@Controller('public')
@UseGuards(StandaloneRobotGuard)
export class StandaloneEnginesController {
  constructor(private readonly engines: StandaloneSpeechEngines) {}
  @Get('ai-agents/providers/list')
  async providers(@Req() req: StandaloneRobotRequest, @Query('capability') kind: EngineKind) {
    return (await this.engines.list(kind, robotTenant(req))).map(row => ({
      uid: row.uid, name: row.name, vendor: row.type, endpoint: row.custom_url || '',
      auth_type: row.auth_mode, capabilities: [kind], is_global: false,
      user_uid: row.user_uid, defaults: row.settings || {}, enabled: true,
    }));
  }
  @Get(':kind')
  async list(@Req() req: StandaloneRobotRequest, @Param('kind') kind: EngineKind) {
    return (await this.engines.list(kind, robotTenant(req))).map(row => this.engines.publicRow(row));
  }
  @Post(':kind')
  create(@Req() req: StandaloneRobotRequest, @Param('kind') kind: EngineKind, @Body() body: Record<string, unknown>) {
    return this.engines.save(kind, robotTenant(req), body);
  }
  @Put(':kind/:uid')
  update(@Req() req: StandaloneRobotRequest, @Param('kind') kind: EngineKind, @Param('uid', ParseIntPipe) uid: number, @Body() body: Record<string, unknown>) {
    return this.engines.save(kind, robotTenant(req), body, uid);
  }
  @Delete(':kind/:uid')
  remove(@Req() req: StandaloneRobotRequest, @Param('kind') kind: EngineKind, @Param('uid', ParseIntPipe) uid: number) {
    return this.engines.remove(kind, robotTenant(req), [uid]);
  }
  @Post(':kind/bulk/delete')
  bulk(@Req() req: StandaloneRobotRequest, @Param('kind') kind: EngineKind, @Body() body: { ids: number[] }) {
    return this.engines.remove(kind, robotTenant(req), body.ids || []);
  }
}
