import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction } from 'sequelize';
import * as crypto from 'crypto';
import { PsEndpoint } from './ps-endpoint.model';
import { PsAuth } from './ps-auth.model';
import { PsAor } from './ps-aor.model';
import { PsContact } from './ps-contact.model';
import { ContextsService } from '../contexts/contexts.service';
import { CreateEndpointDto, BulkCreateEndpointDto } from './dto/create-endpoint.dto';
import { LoggerService } from '../logger/logger.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  buildSipId,
  buildWebrtcSipId,
  extractExtension,
  isWebrtcCompanion,
  companionIdOf,
  primaryIdOf,
} from './endpoint-ids.util';

/** NAT profile presets that auto-configure multiple PJSIP parameters */
const NAT_PROFILES: Record<string, Partial<PsEndpoint>> = {
  lan: {
    direct_media: 'yes',
    force_rport: 'no',
    rewrite_contact: 'no',
    rtp_symmetric: 'no',
    ice_support: 'no',
  },
  nat: {
    direct_media: 'no',
    force_rport: 'yes',
    rewrite_contact: 'yes',
    rtp_symmetric: 'yes',
    ice_support: 'yes',
  },
  webrtc: {
    direct_media: 'no',
    force_rport: 'yes',
    rewrite_contact: 'yes',
    rtp_symmetric: 'yes',
    ice_support: 'yes',
    webrtc: 'yes',
    dtls_auto_generate_cert: 'yes',
    media_encryption: 'dtls',
    rtcp_mux: 'yes',
    bundle: 'yes',
  },
};

export interface BulkJob {
  id: string;
  tenantId: string;
  total: number;
  processed: number;
  created: string[];
  skipped: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

const BULK_JOB_REDIS_PREFIX = 'endpoint-bulk-job:';
const BULK_JOB_REDIS_TTL_SEC = 86400;
const BULK_SYNC_THRESHOLD = 500;

@Injectable()
export class EndpointsService {
  private activeJobs = new Map<string, BulkJob>();
  constructor(
    @InjectModel(PsEndpoint) private endpointModel: typeof PsEndpoint,
    @InjectModel(PsAuth) private authModel: typeof PsAuth,
    @InjectModel(PsAor) private aorModel: typeof PsAor,
    @InjectModel(PsContact) private contactModel: typeof PsContact,
    private sequelize: Sequelize,
    private contextsService: ContextsService,
    private loggerService: LoggerService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  /** Build default context name for a tenant */
  private buildDefaultContext(_vpbxUserUid: number): string {
    return 'from-internal';
  }

  /**
   * Build context with tenant ID suffix.
   * e.g. context='sip-out', tenantId=0 → 'sip-out0'
   * Falls back to default context if context is null/undefined.
   */
  private buildContext(context: string | undefined | null, vpbxUserUid: number): string {
    const base = context || this.buildDefaultContext(vpbxUserUid);
    const suffix = String(vpbxUserUid);
    // If context already ends with the tenant ID, don't duplicate
    if (base.endsWith(suffix)) return base;
    return `${base}${suffix}`;
  }

  /** Generate a cryptographically secure random password */
  private generatePassword(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  private resolvePrimaryNatProfile(natProfile?: string): Partial<PsEndpoint> {
    // WebRTC profile must not land on the primary (desk-phone) endpoint
    if (!natProfile || natProfile === 'webrtc') return NAT_PROFILES.nat;
    return NAT_PROFILES[natProfile] || NAT_PROFILES.nat;
  }

  private async createCompanionTriple(
    vpbxUserUid: number,
    extension: string,
    primary: {
      context: string;
      callerid: string | null;
      department?: string | null;
      language?: string | null;
      allow?: string | null;
    },
    transaction: Transaction,
  ): Promise<string> {
    const webrtcId = buildWebrtcSipId(vpbxUserUid, extension);
    const existing = await this.endpointModel.findByPk(webrtcId, { transaction });
    if (existing) return webrtcId;

    const password = this.generatePassword();
    await this.authModel.create(
      {
        id: webrtcId,
        auth_type: 'userpass',
        username: webrtcId,
        password,
      },
      { transaction },
    );
    await this.aorModel.create(
      {
        id: webrtcId,
        max_contacts: 1,
        qualify_frequency: 60,
        remove_existing: 'yes',
      },
      { transaction },
    );
    await this.endpointModel.create(
      {
        id: webrtcId,
        tenantid: String(vpbxUserUid),
        auth: webrtcId,
        aors: webrtcId,
        context: primary.context,
        callerid: primary.callerid,
        disallow: 'all',
        allow: primary.allow || 'ulaw,alaw,g722,opus',
        transport: 'transport-wss',
        dtmf_mode: 'auto',
        language: primary.language || 'ru',
        department: primary.department || '',
        ...(NAT_PROFILES.webrtc as any),
      },
      { transaction },
    );
    return webrtcId;
  }

  private async destroyEndpointTriple(sipId: string, transaction: Transaction): Promise<void> {
    await this.contactModel.destroy({ where: { endpoint: sipId }, transaction });
    await this.endpointModel.destroy({ where: { id: sipId }, transaction });
    await this.authModel.destroy({ where: { id: sipId }, transaction });
    await this.aorModel.destroy({ where: { id: sipId }, transaction });
  }

  private contactStatus(
    contact: PsContact | undefined | null,
    aorDefaultExpiration?: number | null,
  ): {
    status: 'online' | 'offline';
    userAgent: string | null;
    clientIp: string | null;
    contactUri: string | null;
    lastRegistered: number | null;
  } {
    const now = Math.floor(Date.now() / 1000);
    let lastRegistered: number | null = null;
    if (contact?.updatedAt) {
      lastRegistered = Math.floor(new Date(contact.updatedAt).getTime() / 1000);
    } else if (contact?.expiration_time) {
      const regInterval = aorDefaultExpiration || 3600;
      lastRegistered = contact.expiration_time - regInterval;
    }
    return {
      status: contact && contact.expiration_time > now ? 'online' : 'offline',
      userAgent: contact?.user_agent || null,
      clientIp: contact?.via_addr || null,
      contactUri: contact?.uri || null,
      lastRegistered,
    };
  }

  /** Numeric-aware extension sort: 114 < 1139 < 1140 */
  private compareExtensions(a: string, b: string): number {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    const aIsNum = !isNaN(numA) && String(numA) === a;
    const bIsNum = !isNaN(numB) && String(numB) === b;
    if (aIsNum && bIsNum) return numA - numB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Strip tenant ID suffix from context for display.
   * e.g. 'sip-out0' with tenantId=0 → 'sip-out'
   */
  private stripContext(context: string | null, vpbxUserUid: number): string {
    if (!context) return '';
    const suffix = String(vpbxUserUid);
    if (context.endsWith(suffix)) {
      return context.slice(0, -suffix.length);
    }
    return context;
  }

  private async persistJob(job: BulkJob): Promise<void> {
    this.activeJobs.set(job.id, job);
    await this.redis.set(
      `${BULK_JOB_REDIS_PREFIX}${job.id}`,
      JSON.stringify(job),
      'EX',
      BULK_JOB_REDIS_TTL_SEC,
    );
  }

  private async resolveJob(jobId: string): Promise<BulkJob | undefined> {
    const cached = this.activeJobs.get(jobId);
    if (cached) return cached;

    const raw = await this.redis.get(`${BULK_JOB_REDIS_PREFIX}${jobId}`);
    if (!raw) return undefined;

    try {
      const job = JSON.parse(raw) as BulkJob;
      this.activeJobs.set(jobId, job);
      return job;
    } catch {
      return undefined;
    }
  }

  /**
   * Get all endpoints for a tenant, enriched with registration status.
   * WebRTC companions (ew*) are hidden; status is attached to the primary row.
   */
  async findAll(vpbxUserUid: number) {
    const endpoints = await this.endpointModel.findAll({
      where: { tenantid: String(vpbxUserUid) },
    });

    const primaryEndpoints = endpoints.filter((e) => !isWebrtcCompanion(e.id));
    const companionByPrimary = new Map<string, string>();
    for (const ep of endpoints) {
      if (!isWebrtcCompanion(ep.id)) continue;
      const primaryId = primaryIdOf(ep.id);
      if (primaryId) companionByPrimary.set(primaryId, ep.id);
    }
    const companionIds = [...companionByPrimary.values()];

    const sipIds = [...primaryEndpoints.map((e) => e.id), ...companionIds];
    const contacts = sipIds.length
      ? await this.contactModel.findAll({
          where: { endpoint: { [Op.in]: sipIds } },
        })
      : [];

    const contactMap = new Map<string, PsContact>();
    contacts.forEach((c) => {
      if (c.endpoint) contactMap.set(c.endpoint, c);
    });

    const auths = sipIds.length
      ? await this.authModel.findAll({
          where: { id: { [Op.in]: primaryEndpoints.map((e) => e.id) } },
          attributes: ['id', 'username', 'auth_type'],
        })
      : [];

    const aors = sipIds.length
      ? await this.aorModel.findAll({
          where: { id: { [Op.in]: sipIds } },
          attributes: ['id', 'default_expiration', 'qualify_frequency'],
        })
      : [];

    const authMap = new Map<string, any>();
    auths.forEach((a) => authMap.set(a.id, a));
    const aorMap = new Map<string, any>();
    aors.forEach((a) => aorMap.set(a.id, a));

    return primaryEndpoints
      .map((ep) => {
        const contact = contactMap.get(ep.id);
        const auth = authMap.get(ep.id);
        const aor = aorMap.get(ep.id);
        const epJson = ep.toJSON();
        const statusInfo = this.contactStatus(contact, aor?.default_expiration);

        const webrtcId = companionByPrimary.get(ep.id) || null;
        let webrtc: { id: string; status: 'online' | 'offline'; userAgent?: string | null } | null = null;
        if (webrtcId) {
          const wContact = contactMap.get(webrtcId);
          const wAor = aorMap.get(webrtcId);
          const wStatus = this.contactStatus(wContact, wAor?.default_expiration);
          webrtc = {
            id: webrtcId,
            status: wStatus.status,
            userAgent: wStatus.userAgent,
          };
        }

        return {
          ...epJson,
          webrtc_enabled: !!webrtcId,
          context: this.stripContext(epJson.context, vpbxUserUid),
          extension: extractExtension(ep.id),
          sipUsername: ep.id,
          authType: auth?.auth_type || 'userpass',
          ...statusInfo,
          webrtc,
        };
      })
      .sort((a, b) => this.compareExtensions(a.extension, b.extension));
  }

  /**
   * Get a single endpoint with full details (including AoR and Auth)
   */
  async findOne(sipId: string, vpbxUserUid: number) {
    if (isWebrtcCompanion(sipId)) {
      throw new BadRequestException('Edit the primary endpoint; WebRTC companion is managed automatically');
    }

    const endpoint = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const auth = await this.authModel.findByPk(sipId);
    const aor = await this.aorModel.findByPk(sipId);
    const contact = await this.contactModel.findOne({ where: { endpoint: sipId } });
    const statusInfo = this.contactStatus(contact, aor?.default_expiration);
    const epJson = endpoint.toJSON();

    const webrtcId = companionIdOf(sipId);
    const companion = webrtcId
      ? await this.endpointModel.findByPk(webrtcId)
      : null;
    let webrtc: { id: string; status: 'online' | 'offline'; userAgent?: string | null } | null = null;
    if (companion && webrtcId) {
      const wContact = await this.contactModel.findOne({ where: { endpoint: webrtcId } });
      const wAor = await this.aorModel.findByPk(webrtcId);
      const wStatus = this.contactStatus(wContact, wAor?.default_expiration);
      webrtc = { id: webrtcId, status: wStatus.status, userAgent: wStatus.userAgent };
    }

    return {
      endpoint: {
        ...epJson,
        webrtc_enabled: !!companion,
        context: this.stripContext(epJson.context, vpbxUserUid),
      },
      auth: auth ? { ...auth.toJSON(), password: '********' } : null,
      aor: aor?.toJSON() || null,
      extension: extractExtension(sipId),
      sipUsername: sipId,
      ...statusInfo,
      webrtc,
    };
  }

  /**
   * Get SIP credentials (username + password) for phone provisioning.
   * For primary with WebRTC companion — also returns webrtc credentials.
   */
  async getCredentials(sipId: string, vpbxUserUid: number) {
    const endpoint = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const domain = process.env.SIP_DOMAIN || process.env.DB_HOST || 'localhost';
    const auth = await this.authModel.findByPk(sipId);
    const base = {
      sipId,
      extension: extractExtension(sipId),
      username: auth?.username || sipId,
      password: auth?.password || '',
      authType: auth?.auth_type || 'userpass',
      domain,
    };

    if (isWebrtcCompanion(sipId)) {
      return base;
    }

    const webrtcId = companionIdOf(sipId);
    if (!webrtcId) return base;

    const wAuth = await this.authModel.findByPk(webrtcId);
    if (!wAuth) return base;

    return {
      ...base,
      webrtc: {
        sipId: webrtcId,
        extension: extractExtension(webrtcId),
        username: wAuth.username || webrtcId,
        password: wAuth.password || '',
        authType: wAuth.auth_type || 'userpass',
        domain,
        transport: 'wss',
      },
    };
  }

  /**
   * Create a single endpoint (atomically creates ps_auths + ps_aors + ps_endpoints).
   * Optionally creates a WebRTC companion (ew*) when webrtcEnabled is true.
   */
  async create(dto: CreateEndpointDto, vpbxUserUid: number, userId?: number) {
    const sipId = buildSipId(vpbxUserUid, dto.extension);
    const webrtcEnabled = dto.webrtcEnabled === true;

    // Check uniqueness
    const exists = await this.endpointModel.findByPk(sipId);
    if (exists) throw new ConflictException(`Extension ${dto.extension} already exists`);

    const context = this.buildContext(dto.context, vpbxUserUid);
    const natSettings = this.resolvePrimaryNatProfile(dto.natProfile);
    const callerid = dto.displayName
      ? `"${dto.displayName}" <${dto.extension}>`
      : `"${dto.extension}" <${dto.extension}>`;
    const allow = dto.codecs || 'ulaw,alaw,g722';

    const result = await this.sequelize.transaction(async (t) => {
      await this.authModel.create(
        {
          id: sipId,
          auth_type: 'userpass',
          username: sipId,
          password: dto.password,
        },
        { transaction: t },
      );

      await this.aorModel.create(
        {
          id: sipId,
          max_contacts: 1,
          qualify_frequency: 60,
          remove_existing: 'yes',
        },
        { transaction: t },
      );

      const endpoint = await this.endpointModel.create(
        {
          id: sipId,
          tenantid: String(vpbxUserUid),
          auth: sipId,
          aors: sipId,
          context,
          callerid,
          disallow: 'all',
          allow,
          transport: dto.transport || null,
          dtmf_mode: 'auto',
          language: 'ru',
          department: dto.department || '',
          named_call_group: dto.namedCallGroup || '',
          named_pickup_group: dto.namedPickupGroup || '',
          provision_enabled: dto.provisionEnabled ? 1 : 0,
          mac_address: dto.macAddress || '',
          provision_template_id: dto.provisionTemplateId || null,
          pv_vars: dto.pvVars || '',
          ...(natSettings as any),
          ...(dto.advanced || {}),
        },
        { transaction: t },
      );

      if (webrtcEnabled) {
        await this.createCompanionTriple(
          vpbxUserUid,
          dto.extension,
          { context, callerid, department: dto.department || '', language: 'ru', allow },
          t,
        );
      }

      return endpoint;
    });

    if (userId) {
      await this.loggerService.logAction(
        userId,
        'create',
        'endpoint',
        null,
        vpbxUserUid,
        `Created endpoint ${dto.extension} (${sipId})${webrtcEnabled ? ' + WebRTC companion' : ''}`,
      );
    }

    return {
      ...result.toJSON(),
      extension: dto.extension,
      sipUsername: sipId,
      webrtc_enabled: webrtcEnabled,
    };
  }

  /**
   * Bulk-create a range of endpoints (e.g., 100-150)
   */
  async bulkCreate(dto: BulkCreateEndpointDto, vpbxUserUid: number, userId?: number) {
    const parsedExtensions = new Set<number>();
    const parts = (dto.extensionsPattern || '').split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 5000) {
          for (let i = start; i <= end; i++) {
            parsedExtensions.add(i);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
          parsedExtensions.add(num);
        }
      }
    }

    const extensionsArray = Array.from(parsedExtensions).sort((a, b) => a - b);

    if (extensionsArray.length === 0) {
      throw new ConflictException('Invalid pattern or empty extensions array.');
    }

    await this.contextsService.ensureDefaults(vpbxUserUid);

    if (extensionsArray.length <= BULK_SYNC_THRESHOLD) {
      // Sync processing with internal chunking to avoid transaction timeouts
      const created: string[] = [];
      const skipped: string[] = [];
      
      const chunkSize = 50;
      for (let i = 0; i < extensionsArray.length; i += chunkSize) {
        const chunk = extensionsArray.slice(i, i + chunkSize);
        await this.processBulkChunk(chunk, dto, vpbxUserUid, created, skipped);
      }

      if (userId) {
        await this.loggerService.logAction(
          userId,
          'bulk_create',
          'endpoint',
          null,
          vpbxUserUid,
          `Bulk created ${created.length} endpoints (${dto.extensionsPattern}), skipped ${skipped.length} sync`,
        );
      }
      return { created, skipped, total: created.length };
    } else {
      // Async processing > 200
      const jobId = crypto.randomUUID();
      const job: BulkJob = {
        id: jobId,
        tenantId: String(vpbxUserUid),
        total: extensionsArray.length,
        processed: 0,
        created: [],
        skipped: [],
        status: 'pending',
      };
      await this.persistJob(job);
      
      // Kick off background job without awaiting
      setImmediate(() => this.runBackgroundBulkJob(jobId, extensionsArray, dto, vpbxUserUid, userId));

      return { jobId, total: extensionsArray.length, message: 'Job started in background' };
    }
  }

  async getBulkJobStatus(jobId: string): Promise<BulkJob> {
    const job = await this.resolveJob(jobId);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  getActiveBulkJob(vpbxUserUid: number): { jobId: string | null } {
    const tenantStr = String(vpbxUserUid);
    for (const [id, job] of this.activeJobs.entries()) {
      if (job.tenantId === tenantStr && (job.status === 'pending' || job.status === 'processing')) {
        return { jobId: id };
      }
    }
    return { jobId: null };
  }

  private async runBackgroundBulkJob(jobId: string, extensionsArray: number[], dto: BulkCreateEndpointDto, vpbxUserUid: number, userId?: number) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    await this.persistJob(job);
    const chunkSize = 50;

    try {
      for (let i = 0; i < extensionsArray.length; i += chunkSize) {
        const chunk = extensionsArray.slice(i, i + chunkSize);
        
        await this.processBulkChunk(chunk, dto, vpbxUserUid, job.created, job.skipped);
        job.processed += chunk.length;
        await this.persistJob(job);
      }
      
      job.status = 'completed';
      await this.persistJob(job);
      
      if (userId) {
        await this.loggerService.logAction(
          userId,
          'bulk_create',
          'endpoint',
          null,
          vpbxUserUid,
          `Async Bulk created ${job.created.length} endpoints (${dto.extensionsPattern}), skipped ${job.skipped.length}`,
        );
      }
    } catch (error: any) {
      this.loggerService.logAction(userId || 0, 'bulk_create_error', 'endpoint', null, vpbxUserUid, `Async Bulk failed: ${error.message}`);
      job.status = 'error';
      job.error = error.message;
      await this.persistJob(job);
    } finally {
      // Drop from in-memory cache after 1 hour; Redis keeps status for 24h
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600_000);
    }
  }

  private async processBulkChunk(chunk: number[], dto: BulkCreateEndpointDto, vpbxUserUid: number, createdDest: string[], skippedDest: string[]) {
    const context = this.buildContext(dto.context, vpbxUserUid);
    const natSettings = this.resolvePrimaryNatProfile(dto.natProfile);
    const webrtcEnabled = dto.webrtcEnabled === true;
    const allow = dto.codecs || 'ulaw,alaw,g722';

    await this.sequelize.transaction(async (t) => {
      for (const ext of chunk) {
        const extension = String(ext);
        const sipId = buildSipId(vpbxUserUid, extension);

        const exists = await this.endpointModel.findByPk(sipId, { transaction: t });
        if (exists) {
          skippedDest.push(extension);
          continue;
        }

        const password =
          dto.passwordPattern === 'auto' ? this.generatePassword() : dto.passwordPattern;

        const displayName = dto.displayNamePattern
          ? dto.displayNamePattern.replace('{N}', extension)
          : extension;

        const callerid = `"${displayName}" <${extension}>`;

        await this.authModel.create(
          { id: sipId, auth_type: 'userpass', username: sipId, password },
          { transaction: t },
        );

        await this.aorModel.create(
          { id: sipId, max_contacts: 1, qualify_frequency: 60, remove_existing: 'yes' },
          { transaction: t },
        );

        await this.endpointModel.create(
          {
            id: sipId,
            tenantid: String(vpbxUserUid),
            auth: sipId,
            aors: sipId,
            context,
            callerid,
            disallow: 'all',
            allow,
            transport: dto.transport || null,
            dtmf_mode: 'auto',
            language: 'ru',
            department: dto.department || '',
            ...(natSettings as any),
          },
          { transaction: t },
        );

        if (webrtcEnabled) {
          await this.createCompanionTriple(
            vpbxUserUid,
            extension,
            { context, callerid, department: dto.department || '', language: 'ru', allow },
            t,
          );
        }

        createdDest.push(extension);
      }
    });
  }

  /**
   * Update an endpoint (and optionally its auth/aor).
   * Handles webrtc_enabled toggle: create/destroy companion; syncs fields to companion.
   */
  async update(
    sipId: string,
    data: {
      endpoint?: Partial<PsEndpoint> & { webrtc_enabled?: boolean };
      auth?: Partial<PsAuth>;
      aor?: Partial<PsAor>;
    },
    vpbxUserUid: number,
    userId?: number,
  ) {
    if (isWebrtcCompanion(sipId)) {
      throw new BadRequestException('Edit the primary endpoint; WebRTC companion is managed automatically');
    }

    const existing = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!existing) throw new NotFoundException('Endpoint not found');

    const extension = extractExtension(sipId);
    const webrtcId = companionIdOf(sipId);
    const existingCompanion = webrtcId
      ? await this.endpointModel.findByPk(webrtcId)
      : null;
    const wasEnabled = !!existingCompanion;

    await this.sequelize.transaction(async (t) => {
      const epPatch = data.endpoint ? { ...data.endpoint } : undefined;
      let nextWebrtcEnabled = wasEnabled;

      if (epPatch && typeof (epPatch as any).webrtc_enabled === 'boolean') {
        nextWebrtcEnabled = (epPatch as any).webrtc_enabled;
        delete (epPatch as any).webrtc_enabled; // not a DB column — derived from companion
      }

      if (epPatch) {
        if (epPatch.context) {
          epPatch.context = this.buildContext(epPatch.context, vpbxUserUid);
        }
        // Never put WebRTC media profile on the primary via raw patch
        if ((epPatch as any).webrtc === 'yes') {
          delete (epPatch as any).webrtc;
          delete (epPatch as any).dtls_auto_generate_cert;
          delete (epPatch as any).media_encryption;
          delete (epPatch as any).rtcp_mux;
          delete (epPatch as any).bundle;
        }
        await this.endpointModel.update(epPatch as any, {
          where: { id: sipId },
          transaction: t,
        });
      }
      if (data.auth) {
        await this.authModel.update(data.auth as any, {
          where: { id: sipId },
          transaction: t,
        });
      }
      if (data.aor) {
        await this.aorModel.update(data.aor as any, {
          where: { id: sipId },
          transaction: t,
        });
      }

      if (!wasEnabled && nextWebrtcEnabled && webrtcId) {
        const refreshed = await this.endpointModel.findByPk(sipId, { transaction: t });
        await this.createCompanionTriple(
          vpbxUserUid,
          extension,
          {
            context: refreshed?.context || existing.context,
            callerid: refreshed?.callerid ?? existing.callerid,
            department: refreshed?.department ?? existing.department,
            language: refreshed?.language ?? existing.language,
            allow: refreshed?.allow ?? existing.allow,
          },
          t,
        );
      } else if (wasEnabled && !nextWebrtcEnabled && webrtcId) {
        await this.destroyEndpointTriple(webrtcId, t);
      } else if (nextWebrtcEnabled && webrtcId) {
        // Sync shared fields to companion
        const sync: Partial<PsEndpoint> = {};
        if (epPatch?.callerid !== undefined) sync.callerid = epPatch.callerid;
        if (epPatch?.context !== undefined) sync.context = epPatch.context;
        if (epPatch?.department !== undefined) sync.department = epPatch.department;
        if (epPatch?.language !== undefined) sync.language = epPatch.language;
        if (epPatch?.allow !== undefined) sync.allow = epPatch.allow;
        if (Object.keys(sync).length) {
          await this.endpointModel.update(sync as any, {
            where: { id: webrtcId },
            transaction: t,
          });
        }
      }
    });

    if (userId) {
      await this.loggerService.logAction(
        userId,
        'update',
        'endpoint',
        null,
        vpbxUserUid,
        `Updated endpoint ${extension} (${sipId})`,
      );
    }

    return this.findOne(sipId, vpbxUserUid);
  }

  /**
   * Delete an endpoint (removes primary + WebRTC companion if present)
   */
  async remove(sipId: string, vpbxUserUid: number, userId?: number) {
    if (isWebrtcCompanion(sipId)) {
      throw new BadRequestException('Delete the primary endpoint; WebRTC companion is removed with it');
    }

    const existing = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!existing) throw new NotFoundException('Endpoint not found');

    const webrtcId = companionIdOf(sipId);

    await this.sequelize.transaction(async (t) => {
      if (webrtcId) {
        await this.destroyEndpointTriple(webrtcId, t);
      }
      await this.destroyEndpointTriple(sipId, t);
    });

    if (userId) {
      await this.loggerService.logAction(
        userId,
        'delete',
        'endpoint',
        null,
        vpbxUserUid,
        `Deleted endpoint ${extractExtension(sipId)} (${sipId})`,
      );
    }
  }

  /**
   * Bulk-delete multiple endpoints atomically (includes WebRTC companions)
   */
  async bulkRemove(sipIds: string[], vpbxUserUid: number, userId?: number) {
    const primaryIds = sipIds.filter((id) => !isWebrtcCompanion(id));
    const endpoints = await this.endpointModel.findAll({
      where: { id: { [Op.in]: primaryIds }, tenantid: String(vpbxUserUid) },
    });

    const validIds = endpoints.map((e) => e.id);
    if (validIds.length === 0) throw new NotFoundException('No matching endpoints found');

    const companionIds = validIds
      .map((id) => companionIdOf(id))
      .filter((id): id is string => !!id);
    const allIds = [...validIds, ...companionIds];

    await this.sequelize.transaction(async (t) => {
      await this.contactModel.destroy({ where: { endpoint: { [Op.in]: allIds } }, transaction: t });
      await this.endpointModel.destroy({ where: { id: { [Op.in]: allIds } }, transaction: t });
      await this.authModel.destroy({ where: { id: { [Op.in]: allIds } }, transaction: t });
      await this.aorModel.destroy({ where: { id: { [Op.in]: allIds } }, transaction: t });
    });

    if (userId) {
      const extensions = validIds.map((id) => extractExtension(id)).join(', ');
      await this.loggerService.logAction(
        userId,
        'bulk_delete',
        'endpoint',
        null,
        vpbxUserUid,
        `Bulk deleted ${validIds.length} endpoints: ${extensions}`,
      );
    }

    return { deleted: validIds.length, ids: validIds };
  }

  /** Extensions that have a WebRTC companion (ew*) — for dialplan generation */
  async listWebrtcEnabledExtensions(vpbxUserUid: number): Promise<Set<string>> {
    const rows = await this.endpointModel.findAll({
      where: {
        tenantid: String(vpbxUserUid),
        id: { [Op.like]: 'ew%' },
      },
      attributes: ['id'],
    });
    return new Set(rows.map((r) => extractExtension(r.id)));
  }
}
