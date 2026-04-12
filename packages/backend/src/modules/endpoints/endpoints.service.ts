import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import * as crypto from 'crypto';
import { PsEndpoint } from './ps-endpoint.model';
import { PsAuth } from './ps-auth.model';
import { PsAor } from './ps-aor.model';
import { PsContact } from './ps-contact.model';
import { ContextsService } from '../contexts/contexts.service';
import { CreateEndpointDto, BulkCreateEndpointDto } from './dto/create-endpoint.dto';
import { LoggerService } from '../logger/logger.service';

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
  ) {}

  /** Build globally unique SIP ID: e{extension}_{vpbxUserUid} */
  private buildSipId(vpbxUserUid: number, extension: string): string {
    return `e${extension}_${vpbxUserUid}`;
  }

  /** Build default context name for a tenant */
  private buildDefaultContext(vpbxUserUid: number): string {
    return `ctx-${vpbxUserUid}`;
  }

  /**
   * Build context with tenant ID suffix.
   * e.g. context='sip-out', tenantId=0 → 'sip-out0'
   */
  private buildContext(context: string, vpbxUserUid: number): string {
    const suffix = String(vpbxUserUid);
    // If context already ends with the tenant ID, don't duplicate
    if (context.endsWith(suffix)) return context;
    return `${context}${suffix}`;
  }

  /** Generate a cryptographically secure random password */
  private generatePassword(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  /** Extract user-facing extension number from SIP ID */
  private extractExtension(sipId: string): string {
    // e100_42 → "100"
    const match = sipId.match(/^e(.+)_\d+$/);
    return match ? match[1] : sipId;
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

  /**
   * Get all endpoints for a tenant, enriched with registration status
   */
  async findAll(vpbxUserUid: number) {
    const endpoints = await this.endpointModel.findAll({
      where: { tenantid: String(vpbxUserUid) },
      order: [['id', 'ASC']],
    });

    // Get active contacts (registration status) for all endpoints
    const sipIds = endpoints.map((e) => e.id);
    const contacts = sipIds.length
      ? await this.contactModel.findAll({
          where: { endpoint: { [Op.in]: sipIds } },
        })
      : [];

    const contactMap = new Map<string, any>();
    contacts.forEach((c) => {
      if (c.endpoint) contactMap.set(c.endpoint, c);
    });

    // Get auth data (to show username, but NOT password in list)
    const auths = sipIds.length
      ? await this.authModel.findAll({
          where: { id: { [Op.in]: sipIds } },
          attributes: ['id', 'username', 'auth_type'],
        })
      : [];

    // Get AOR data for default_expiration
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

    return endpoints.map((ep) => {
      const contact = contactMap.get(ep.id);
      const auth = authMap.get(ep.id);
      const aor = aorMap.get(ep.id);
      const now = Math.floor(Date.now() / 1000);
      const epJson = ep.toJSON();

      let lastRegistered: number | null = null;
      if (contact?.updatedAt) {
        // Convert JS Date to Unix timestamp (seconds) to match existing logic
        lastRegistered = Math.floor(new Date(contact.updatedAt).getTime() / 1000);
      } else if (contact?.expiration_time) {
        // Fallback for older records before the column was populated
        const regInterval = aor?.default_expiration || 3600;
        lastRegistered = contact.expiration_time - regInterval;
      }

      return {
        ...epJson,
        context: this.stripContext(epJson.context, vpbxUserUid),
        extension: this.extractExtension(ep.id),
        sipUsername: ep.id,
        authType: auth?.auth_type || 'userpass',
        status: contact && contact.expiration_time > now ? 'online' : 'offline',
        userAgent: contact?.user_agent || null,
        clientIp: contact?.via_addr || null,
        contactUri: contact?.uri || null,
        lastRegistered,
      };
    });
  }

  /**
   * Get a single endpoint with full details (including AoR and Auth)
   */
  async findOne(sipId: string, vpbxUserUid: number) {
    const endpoint = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const auth = await this.authModel.findByPk(sipId);
    const aor = await this.aorModel.findByPk(sipId);
    const contact = await this.contactModel.findOne({ where: { endpoint: sipId } });

    const now = Math.floor(Date.now() / 1000);

    // Calculate last registration time
    let lastRegistered: number | null = null;
    if (contact?.updatedAt) {
      lastRegistered = Math.floor(new Date(contact.updatedAt).getTime() / 1000);
    } else if (contact?.expiration_time) {
      const regInterval = aor?.default_expiration || 3600;
      lastRegistered = contact.expiration_time - regInterval;
    }

    const epJson = endpoint.toJSON();

    return {
      endpoint: { ...epJson, context: this.stripContext(epJson.context, vpbxUserUid) },
      auth: auth ? { ...auth.toJSON(), password: '********' } : null,
      aor: aor?.toJSON() || null,
      extension: this.extractExtension(sipId),
      sipUsername: sipId,
      status: contact && contact.expiration_time > now ? 'online' : 'offline',
      userAgent: contact?.user_agent || null,
      clientIp: contact?.via_addr || null,
      contactUri: contact?.uri || null,
      lastRegistered,
    };
  }

  /**
   * Get SIP credentials (username + password) for phone provisioning
   */
  async getCredentials(sipId: string, vpbxUserUid: number) {
    const endpoint = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const auth = await this.authModel.findByPk(sipId);
    return {
      sipId,
      extension: this.extractExtension(sipId),
      username: auth?.username || sipId,
      password: auth?.password || '',
      authType: auth?.auth_type || 'userpass',
      domain: process.env.SIP_DOMAIN || process.env.DB_HOST || 'localhost',
    };
  }

  /**
   * Create a single endpoint (atomically creates ps_auths + ps_aors + ps_endpoints)
   */
  async create(dto: CreateEndpointDto, vpbxUserUid: number, userId?: number) {
    const sipId = this.buildSipId(vpbxUserUid, dto.extension);

    // Check uniqueness
    const exists = await this.endpointModel.findByPk(sipId);
    if (exists) throw new ConflictException(`Extension ${dto.extension} already exists`);

    const context = this.buildContext(dto.context, vpbxUserUid);
    const natSettings = dto.natProfile ? (NAT_PROFILES[dto.natProfile] || {}) : NAT_PROFILES.nat;
    const callerid = dto.displayName
      ? `"${dto.displayName}" <${dto.extension}>`
      : `"${dto.extension}" <${dto.extension}>`;

    const result = await this.sequelize.transaction(async (t) => {
      // 1. Create auth record
      await this.authModel.create(
        {
          id: sipId,
          auth_type: 'userpass',
          username: sipId,
          password: dto.password,
        },
        { transaction: t },
      );

      // 2. Create AoR record
      await this.aorModel.create(
        {
          id: sipId,
          max_contacts: 1,
          qualify_frequency: 60,
          remove_existing: 'yes',
        },
        { transaction: t },
      );

      // 3. Create endpoint record
      const endpoint = await this.endpointModel.create(
        {
          id: sipId,
          tenantid: String(vpbxUserUid),
          auth: sipId,
          aors: sipId,
          context,
          callerid,
          disallow: 'all',
          allow: dto.codecs || 'ulaw,alaw,g722',
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

      return endpoint;
    });

    // Log the action
    if (userId) {
      await this.loggerService.logAction(
        userId,
        'create',
        'endpoint',
        null,
        vpbxUserUid,
        `Created endpoint ${dto.extension} (${sipId})`,
      );
    }

    return {
      ...result.toJSON(),
      extension: dto.extension,
      sipUsername: sipId,
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

    if (extensionsArray.length <= 200) {
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
      this.activeJobs.set(jobId, job);
      
      // Kick off background job without awaiting
      setImmediate(() => this.runBackgroundBulkJob(jobId, extensionsArray, dto, vpbxUserUid, userId));

      return { jobId, total: extensionsArray.length, message: 'Job started in background' };
    }
  }

  getBulkJobStatus(jobId: string): BulkJob {
    const job = this.activeJobs.get(jobId);
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
    const chunkSize = 50;

    try {
      for (let i = 0; i < extensionsArray.length; i += chunkSize) {
        const chunk = extensionsArray.slice(i, i + chunkSize);
        
        await this.processBulkChunk(chunk, dto, vpbxUserUid, job.created, job.skipped);
        job.processed += chunk.length;
      }
      
      job.status = 'completed';
      
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
    } finally {
      // Garbage collect after 1 hour
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600_000);
    }
  }

  private async processBulkChunk(chunk: number[], dto: BulkCreateEndpointDto, vpbxUserUid: number, createdDest: string[], skippedDest: string[]) {
    const context = this.buildContext(dto.context, vpbxUserUid);
    const natSettings = dto.natProfile ? (NAT_PROFILES[dto.natProfile] || {}) : NAT_PROFILES.nat;

    await this.sequelize.transaction(async (t) => {
      for (const ext of chunk) {
        const extension = String(ext);
        const sipId = this.buildSipId(vpbxUserUid, extension);

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
            allow: dto.codecs || 'ulaw,alaw,g722',
            transport: dto.transport || null,
            dtmf_mode: 'auto',
            language: 'ru',
            ...(natSettings as any),
          },
          { transaction: t },
        );

        createdDest.push(extension);
      }
    });
  }

  /**
   * Update an endpoint (and optionally its auth/aor)
   */
  async update(
    sipId: string,
    data: {
      endpoint?: Partial<PsEndpoint>;
      auth?: Partial<PsAuth>;
      aor?: Partial<PsAor>;
    },
    vpbxUserUid: number,
    userId?: number,
  ) {
    const existing = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!existing) throw new NotFoundException('Endpoint not found');

    await this.sequelize.transaction(async (t) => {
      if (data.endpoint) {
        // Ensure context always has tenant ID suffix
        if (data.endpoint.context) {
          data.endpoint.context = this.buildContext(data.endpoint.context, vpbxUserUid);
        }
        await this.endpointModel.update(data.endpoint as any, {
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
    });

    if (userId) {
      await this.loggerService.logAction(
        userId,
        'update',
        'endpoint',
        null,
        vpbxUserUid,
        `Updated endpoint ${this.extractExtension(sipId)} (${sipId})`,
      );
    }

    return this.findOne(sipId, vpbxUserUid);
  }

  /**
   * Delete an endpoint (removes all 3 records atomically)
   */
  async remove(sipId: string, vpbxUserUid: number, userId?: number) {
    const existing = await this.endpointModel.findOne({
      where: { id: sipId, tenantid: String(vpbxUserUid) },
    });
    if (!existing) throw new NotFoundException('Endpoint not found');

    await this.sequelize.transaction(async (t) => {
      await this.contactModel.destroy({ where: { endpoint: sipId }, transaction: t });
      await this.endpointModel.destroy({ where: { id: sipId }, transaction: t });
      await this.authModel.destroy({ where: { id: sipId }, transaction: t });
      await this.aorModel.destroy({ where: { id: sipId }, transaction: t });
    });

    if (userId) {
      await this.loggerService.logAction(
        userId,
        'delete',
        'endpoint',
        null,
        vpbxUserUid,
        `Deleted endpoint ${this.extractExtension(sipId)} (${sipId})`,
      );
    }
  }

  /**
   * Bulk-delete multiple endpoints atomically
   */
  async bulkRemove(sipIds: string[], vpbxUserUid: number, userId?: number) {
    // Verify all belong to this tenant
    const endpoints = await this.endpointModel.findAll({
      where: { id: { [Op.in]: sipIds }, tenantid: String(vpbxUserUid) },
    });

    const validIds = endpoints.map((e) => e.id);
    if (validIds.length === 0) throw new NotFoundException('No matching endpoints found');

    await this.sequelize.transaction(async (t) => {
      await this.contactModel.destroy({ where: { endpoint: { [Op.in]: validIds } }, transaction: t });
      await this.endpointModel.destroy({ where: { id: { [Op.in]: validIds } }, transaction: t });
      await this.authModel.destroy({ where: { id: { [Op.in]: validIds } }, transaction: t });
      await this.aorModel.destroy({ where: { id: { [Op.in]: validIds } }, transaction: t });
    });

    if (userId) {
      const extensions = validIds.map((id) => this.extractExtension(id)).join(', ');
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
}
