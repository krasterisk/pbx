import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction } from 'sequelize';
import { createHash } from 'node:crypto';
import { PhoneSession } from './phone-session.model';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { companionIdOf, extractExtension, isPrimarySubscriber, primaryIdOf } from '../endpoints/endpoint-ids.util';
import { EndpointsService } from '../endpoints/endpoints.service';
import { User, UserLevel } from '../users/user.model';
import { CcAgentSession } from '../callcenter/models/agent-session.model';
import { AmiService } from '../ami/ami.service';
import { CcContact } from '../callcenter/models/cc-contact.model';

export const PHONE_LEASE_MS = 120_000;
export function phoneDialTarget(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !/^[+\d*#().\s-]+$/.test(value)) {
    throw new BadRequestException('Invalid telephone number');
  }
  const target = value.replace(/[().\s-]/g, '');
  if (!/^\+?[\d*#]+$/.test(target)) throw new BadRequestException('Invalid telephone number');
  return target;
}

@Injectable()
export class PhoneSessionService {
  constructor(
    private readonly db: Sequelize,
    @InjectModel(PhoneSession) private readonly sessions: typeof PhoneSession,
    @InjectModel(PsEndpoint) private readonly endpoints: typeof PsEndpoint,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(CcAgentSession) private readonly shifts: typeof CcAgentSession,
    private readonly endpointService: EndpointsService,
    private readonly ami: AmiService,
    @InjectModel(CcContact) private readonly contacts?: typeof CcContact,
  ) {}

  private async authorize(tenant: number, userId: number) {
    const user = await this.users.findOne({ where: { uniqueid: userId, vpbx_user_uid: tenant }, attributes: ['level'] });
    if (!user || ![UserLevel.SUPERADMIN, UserLevel.ADMIN, UserLevel.OPERATOR, UserLevel.SUPERVISOR].includes(user.level)) {
      throw new ForbiddenException('Telephone access denied');
    }
  }

  private hash(owner: string) {
    if (typeof owner !== 'string' || !/^[a-f0-9-]{36}$/i.test(owner)) throw new BadRequestException('Invalid phone owner');
    return createHash('sha256').update(owner).digest('hex');
  }

  private primary(endpoint: string, tenant: number) {
    if (typeof endpoint !== 'string') throw new BadRequestException('Telephone is required');
    const primary = primaryIdOf(endpoint) || endpoint;
    if (!isPrimarySubscriber(primary, tenant)) throw new ForbiddenException('Endpoint belongs to another organisation');
    return primary;
  }

  private async withUser<T>(tenant: number, userId: number, fn: (row: PhoneSession, tx: Transaction) => Promise<T>): Promise<T> {
    await this.sessions.findOrCreate({ where: { tenant, user_id: userId }, defaults: { expires_at: 0 } });
    return this.db.transaction(async (tx) => {
      const row = await this.sessions.findOne({ where: { tenant, user_id: userId }, transaction: tx, lock: tx.LOCK.UPDATE });
      if (!row) throw new ServiceUnavailableException('Phone ownership unavailable');
      return fn(row, tx);
    });
  }

  /** The primary endpoint row is the common SIP/WebRTC mutex, including CC login. */
  private async lockEndpoint(primary: string, tenant: number, tx: Transaction) {
    const endpoint = await this.endpoints.findOne({ where: { id: primary, tenantid: String(tenant) }, transaction: tx, lock: tx.LOCK.UPDATE });
    if (!endpoint) throw new NotFoundException('Telephone not found');
    return endpoint;
  }

  private async assertIdle(primary: string) {
    const channels = await this.ami.getActiveChannels();
    if (!channels.complete) throw new ServiceUnavailableException('Cannot verify telephone availability');
    const ids = [primary, companionIdOf(primary)].filter(Boolean);
    if (channels.events.some((event) => ids.some((id) => String(event.channel || event.Channel || '').startsWith(`PJSIP/${id}-`)))) {
      throw new ConflictException('Telephone has an active call');
    }
  }

  private async assertNoShift(userId: number, primary: string, tx: Transaction) {
    const interfaces = [primary, companionIdOf(primary)].filter(Boolean).flatMap((id) => [`PJSIP/${id}`, `SIP/${id}`]);
    const shift = await this.shifts.findOne({
      where: { logout_time: null, [Op.or]: [{ user_id: userId }, { agent_interface: { [Op.in]: interfaces } }] }, transaction: tx,
    });
    if (shift) throw new ConflictException('Use the active call-centre session or close it first');
  }

  /** Called around the existing login, without creating a second shift or changing KPI. */
  async guardCallCenterLogin<T>(iface: string, tenant: number, userId: number, login: () => Promise<T>): Promise<T> {
    const primary = this.primary(iface.replace(/^(PJSIP|SIP)\//, ''), tenant);
    return this.withUser(tenant, userId, async (row, tx) => {
      await this.lockEndpoint(primary, tenant, tx);
      const occupied = await this.sessions.findOne({ where: {
        tenant, expires_at: { [Op.gt]: Date.now() }, [Op.or]: [{ user_id: userId }, { endpoint: primary }],
      }, transaction: tx });
      if (occupied) throw new ConflictException('Disconnect the ordinary telephone session first');
      // Preserve existing CC re-login behaviour unless an expired ordinary lease could still own a call.
      const expiredOwner = await this.sessions.findOne({ where: { tenant, endpoint: primary }, transaction: tx });
      if (expiredOwner) await this.assertIdle(primary);
      return login();
    });
  }

  async list(tenant: number, userId: number) {
    await this.authorize(tenant, userId);
    // Do not return the endpoint CRUD payload (it contains SIP/auth configuration).
    const endpoints = await this.endpoints.findAll({ where: { tenantid: String(tenant) }, attributes: ['id', 'callerid', 'webrtc'] });
    const leases = await this.sessions.findAll({ where: { tenant, expires_at: { [Op.gt]: Date.now() }, endpoint: { [Op.ne]: null } } });
    const shifts = await this.shifts.findAll({ where: { logout_time: null }, attributes: ['agent_interface', 'user_id'] });
    const ownShift = shifts.find((shift) => shift.user_id === userId);
    const ownSipId = ownShift?.agent_interface.replace(/^(PJSIP|SIP)\//, '');
    const [channels, devices] = await Promise.all([
      this.ami.getActiveChannels(), this.ami.collectDashboardEndpoints(AbortSignal.timeout(5000)),
    ]);
    const readySip = new Set(devices.complete ? devices.events.filter(event =>
      /^(notinuse|idle)$/i.test(String(event.devicestate || event.DeviceState || '').replace(/[\s_-]/g, '')))
      .map(event => String(event.objectname || event.ObjectName || '')) : []);
    return {
      callCenterActive: Boolean(ownShift),
      availabilityKnown: channels.complete,
      callCenterPhone: ownSipId ? { mode: primaryIdOf(ownSipId) ? 'webrtc' as const : 'sip' as const,
        extension: extractExtension(ownSipId) } : null,
      endpoints: endpoints.filter((ep) => isPrimarySubscriber(ep.id, tenant)).map((ep) => ({
        id: ep.id, extension: extractExtension(ep.id), name: ep.callerid?.replace(/\s*<[^>]*>\s*$/, '').replace(/^"|"$/g, '') || '',
        webrtc: endpoints.some((twin) => twin.id === companionIdOf(ep.id) && /^(yes|true|1)$/i.test(twin.webrtc || '')) && Boolean(process.env.ASTERISK_WSS_URL?.trim()),
        sipAvailable: devices.complete && readySip.has(ep.id),
        available: channels.complete && !channels.events.some(event => [ep.id, companionIdOf(ep.id)].filter(Boolean).some(id => String(event.channel || event.Channel || '').startsWith(`PJSIP/${id}-`)))
          && !leases.some((lease) => lease.endpoint === ep.id)
          && !shifts.some((shift) => [ep.id, companionIdOf(ep.id)].some((id) => shift.agent_interface === `PJSIP/${id}` || shift.agent_interface === `SIP/${id}`)),
      })),
    };
  }

  /** Same shared tenant book as CC, without operator/shift APIs or SIP secrets. */
  async directory(tenant: number, userId: number, search = '') {
    await this.authorize(tenant, userId);
    const term = search.trim().slice(0, 80).replace(/[\\%_]/g, '\\$&');
    const like = `%${term}%`;
    const [book, endpoints] = await Promise.all([
      this.contacts!.findAll({ where: { user_uid: tenant, ...(term ? { [Op.or]: [{ name: { [Op.like]: like } }, { number: { [Op.like]: like } }] } : {}) }, attributes: ['uid', 'name', 'number'], order: [['name', 'ASC'], ['uid', 'ASC']], limit: 101 }),
      this.endpoints.findAll({ where: { tenantid: String(tenant), ...(term ? { [Op.or]: [{ callerid: { [Op.like]: like } }, { id: { [Op.like]: like } }] } : {}) }, attributes: ['id', 'callerid'], order: [['id', 'ASC']], limit: 201 }),
    ]);
    return { rows: [
      ...endpoints.filter(ep => isPrimarySubscriber(ep.id, tenant)).slice(0, 100).map(ep => ({ id: `extension:${ep.id}`, name: ep.callerid?.replace(/\s*<[^>]*>\s*$/, '').replace(/^"|"$/g, '') || extractExtension(ep.id), number: extractExtension(ep.id), kind: 'employee' as const })),
      ...book.slice(0, 100).map(contact => ({ id: `contact:${contact.uid}`, name: contact.name, number: contact.number, kind: 'contact' as const })),
    ], truncated: book.length > 100 || endpoints.length > 200 };
  }

  async acquire(tenant: number, userId: number, endpointId: string, mode: 'sip' | 'webrtc', owner: string) {
    await this.authorize(tenant, userId);
    const ownerHash = this.hash(owner);
    const primary = this.primary(endpointId, tenant);
    if (!['sip', 'webrtc'].includes(mode)) throw new BadRequestException('Invalid telephone mode');
    return this.withUser(tenant, userId, async (row, tx) => {
      const now = Date.now();
      const existing = row.endpoint && Number(row.expires_at) > now;
      const changing = Boolean(row.endpoint && (row.endpoint !== primary || row.mode !== mode));
      if (existing && row.owner_hash !== ownerHash) throw new ConflictException('A telephone session is already active; disconnect it first');
      if (Number(row.dial_pending_until) > now) throw new ConflictException('A call is being started');
      // Deterministic old/new lock order makes switching atomic and avoids cross-switch deadlocks.
      for (const id of [...new Set([primary, ...(changing ? [row.endpoint!] : [])])].sort()) await this.lockEndpoint(id, tenant, tx);
      await this.assertNoShift(userId, primary, tx);
      if (row.endpoint && Number(row.dial_pending_until) > now && !existing) throw new ConflictException('A call is being started');
      const occupied = await this.sessions.findOne({ where: { tenant, endpoint: primary, user_id: { [Op.ne]: userId }, expires_at: { [Op.gt]: now } }, transaction: tx });
      if (occupied) throw new ConflictException('Telephone already in use');
      if (changing) await this.assertIdle(row.endpoint!);
      await this.assertIdle(primary);
      if (mode === 'sip' && await this.ami.isPjsipEndpointReachable(primary) !== true) throw new ServiceUnavailableException('Desk telephone is not registered or its availability cannot be verified');
      if (mode === 'webrtc') {
        const twin = await this.endpoints.findOne({ where: { id: companionIdOf(primary)!, tenantid: String(tenant) }, transaction: tx });
        if (!twin || !/^(yes|true|1)$/i.test(twin.webrtc || '') || !process.env.ASTERISK_WSS_URL?.trim()) throw new BadRequestException('Browser telephone is not configured');
      }
      await row.update({ endpoint: primary, mode, owner_hash: ownerHash, expires_at: now + PHONE_LEASE_MS,
        ...(!existing || changing ? { dial_pending_until: 0 } : {}) }, { transaction: tx });
      return { endpoint: primary, extension: extractExtension(primary), mode, expiresAt: now + PHONE_LEASE_MS };
    });
  }

  private async owned(tenant: number, userId: number, owner: string, fn: (row: PhoneSession, tx: Transaction) => Promise<unknown>) {
    await this.authorize(tenant, userId);
    const ownerHash = this.hash(owner);
    return this.withUser(tenant, userId, async (row, tx) => {
      if (!row.endpoint || row.owner_hash !== ownerHash || Number(row.expires_at) <= Date.now()) throw new ConflictException('Telephone session expired or belongs to another window');
      await this.lockEndpoint(row.endpoint, tenant, tx);
      await this.assertNoShift(userId, row.endpoint, tx);
      return fn(row, tx);
    });
  }

  heartbeat(tenant: number, userId: number, owner: string) {
    return this.owned(tenant, userId, owner, async (row, tx) => {
      const expiresAt = Date.now() + PHONE_LEASE_MS;
      await row.update({ expires_at: expiresAt }, { transaction: tx });
      return { expiresAt, endpoint: row.endpoint!, extension: extractExtension(row.endpoint!), mode: row.mode! };
    });
  }

  release(tenant: number, userId: number, owner: string) {
    return this.owned(tenant, userId, owner, async (row, tx) => {
      if (Number(row.dial_pending_until) > Date.now()) throw new ConflictException('A call is being started');
      await this.assertIdle(row.endpoint!);
      await row.update({ endpoint: null, mode: null, owner_hash: null, expires_at: 0 }, { transaction: tx });
      return { success: true };
    });
  }

  credentials(tenant: number, userId: number, owner: string) {
    return this.owned(tenant, userId, owner, async (row) => {
      if (row.mode !== 'webrtc') throw new BadRequestException('Not a browser telephone');
      const credentials = await this.endpointService.getCredentials(companionIdOf(row.endpoint!)!, tenant);
      return { username: credentials.username, password: credentials.password, domain: credentials.domain };
    });
  }

  dial(tenant: number, userId: number, owner: string, number: string) {
    const target = phoneDialTarget(number);
    return this.owned(tenant, userId, owner, async (row, tx) => {
      if (Number(row.dial_pending_until) > Date.now()) throw new ConflictException('A call is being started');
      await this.assertIdle(row.endpoint!);
      await row.update({ dial_pending_until: Date.now() + 10_000 }, { transaction: tx });
      if (row.mode === 'webrtc') return { success: true, mode: 'webrtc', target };
      const endpoint = await this.lockEndpoint(row.endpoint!, tenant, tx);
      const context = endpoint.context;
      if (!context || !/^[\w-]+$/.test(context)) throw new BadRequestException('Telephone dialplan is not configured');
      const extension = extractExtension(endpoint.id);
      if (!/^[\d*#]+$/.test(extension)) throw new BadRequestException('Invalid extension');
      // Same dialplan contract as CC; no CC status, counters, queue membership or auto-answer.
      await this.ami.action({ action: 'Originate', channel: `PJSIP/${endpoint.id}`, context: 'krsk-click-to-call',
        exten: target, priority: '1', callerid: `"click-to-call" <${target}>`, async: 'true',
        variable: `KRSK_CTC_CONTEXT=${context},KRSK_CTC_OP_NUM=${extension}` });
      return { success: true, mode: 'sip', target };
    });
  }
}
