import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { PsAuth } from '../endpoints/ps-auth.model';
import { PsAor } from '../endpoints/ps-aor.model';
import { PsRegistration } from './ps-registration.model';
import { PsEndpointIdIp } from './ps-endpoint-id-ip.model';
import { AmiService } from '../ami/ami.service';
import { LoggerService } from '../logger/logger.service';

export interface CreateTrunkDto {
  name: string;
  trunkType: 'auth' | 'ip';
  host: string;
  port?: number;
  username?: string;
  password?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  fromUser?: string;
  fromDomain?: string;
  contactUser?: string;
  matchIp?: string;
  advanced?: Record<string, any>;
}

export interface UpdateTrunkDto {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  context?: string;
  transport?: string;
  codecs?: string;
  fromUser?: string;
  fromDomain?: string;
  contactUser?: string;
  matchIp?: string;
  advanced?: Record<string, any>;
}

@Injectable()
export class TrunksService {
  private readonly logger = new Logger(TrunksService.name);

  constructor(
    @InjectModel(PsEndpoint) private endpointModel: typeof PsEndpoint,
    @InjectModel(PsAuth) private authModel: typeof PsAuth,
    @InjectModel(PsAor) private aorModel: typeof PsAor,
    @InjectModel(PsRegistration) private registrationModel: typeof PsRegistration,
    @InjectModel(PsEndpointIdIp) private endpointIdIpModel: typeof PsEndpointIdIp,
    private sequelize: Sequelize,
    private amiService: AmiService,
    private loggerService: LoggerService,
  ) {}

  /** Build a unique trunk ID: t_{name}_{tenantId} */
  private buildTrunkId(name: string, vpbxUserUid: number): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `t_${slug}_${vpbxUserUid}`;
  }

  /** Build default context for incoming trunk calls */
  private buildContext(context: string | undefined, vpbxUserUid: number): string {
    const base = context || 'from-trunk';
    const suffix = String(vpbxUserUid);
    if (base.endsWith(suffix)) return base;
    return `${base}${suffix}`;
  }

  /**
   * Get all trunks for a tenant.
   * Trunks are identified by tenantid prefix in the endpoint id.
   */
  async findAll(vpbxUserUid: number) {
    const tenantStr = String(vpbxUserUid);

    // Get all endpoints that are trunks (prefixed with 't_')
    const endpoints = await this.endpointModel.findAll({
      where: { tenantid: tenantStr },
      order: [['id', 'ASC']],
    });

    // Filter only trunk endpoints (id starts with 't_')
    const trunkEndpoints = endpoints.filter((ep) => ep.id.startsWith('t_'));
    const trunkIds = trunkEndpoints.map((ep) => ep.id);

    // Load related data in parallel
    const [auths, registrations, idIps] = await Promise.all([
      trunkIds.length
        ? this.authModel.findAll({ where: { id: trunkIds } })
        : [],
      trunkIds.length
        ? this.registrationModel.findAll({ where: { id: trunkIds } })
        : [],
      trunkIds.length
        ? this.endpointIdIpModel.findAll({ where: { endpoint: trunkIds } })
        : [],
    ]);

    const authMap = new Map(auths.map((a) => [a.id, a]));
    const regMap = new Map(registrations.map((r) => [r.id, r]));
    const ipMap = new Map(idIps.map((ip) => [ip.endpoint, ip]));

    // Try to get live registration statuses from AMI
    let regStatuses = new Map<string, string>();
    try {
      if (this.amiService.isConnected()) {
        const result = await this.amiService.pjsipShowRegistrations();
        if (result && Array.isArray(result.events)) {
          result.events.forEach((evt: any) => {
            if (evt.event === 'OutboundRegistrationDetail') {
              regStatuses.set(evt.objectname || '', evt.status || '');
            }
          });
        }
      }
    } catch (e) {
      this.logger.warn('Could not fetch registration statuses from AMI');
    }

    return trunkEndpoints.map((ep) => {
      const auth = authMap.get(ep.id);
      const reg = regMap.get(ep.id);
      const idIp = ipMap.get(ep.id);
      const trunkType = reg ? 'auth' : 'ip';
      const liveStatus = regStatuses.get(ep.id) || null;

      return {
        id: ep.id,
        name: this.extractTrunkName(ep.id, vpbxUserUid),
        trunkType,
        host: reg?.server_uri?.replace('sip:', '').split('@').pop() || idIp?.match || '',
        context: this.stripContext(ep.context, vpbxUserUid),
        transport: ep.transport || '',
        codecs: ep.allow || '',
        username: auth?.username || '',
        fromUser: ep.from_user || '',
        fromDomain: ep.from_domain || '',
        contactUser: reg?.contact_user || '',
        matchIp: idIp?.match || '',
        registrationStatus: trunkType === 'auth' ? (liveStatus || 'unknown') : null,
        serverUri: reg?.server_uri || '',
        clientUri: reg?.client_uri || '',
      };
    });
  }

  /**
   * Get a single trunk by its trunk ID.
   */
  async findOne(trunkId: string, vpbxUserUid: number) {
    const endpoint = await this.endpointModel.findOne({
      where: { id: trunkId, tenantid: String(vpbxUserUid) },
    });
    if (!endpoint || !trunkId.startsWith('t_')) {
      throw new NotFoundException('Trunk not found');
    }

    const [auth, aor, reg, idIp] = await Promise.all([
      this.authModel.findByPk(trunkId),
      this.aorModel.findByPk(trunkId),
      this.registrationModel.findByPk(trunkId),
      this.endpointIdIpModel.findOne({ where: { endpoint: trunkId } }),
    ]);

    const trunkType = reg ? 'auth' : 'ip';

    return {
      id: endpoint.id,
      name: this.extractTrunkName(trunkId, vpbxUserUid),
      trunkType,
      endpoint: endpoint.toJSON(),
      auth: auth ? { ...auth.toJSON(), password: '********' } : null,
      aor: aor?.toJSON() || null,
      registration: reg?.toJSON() || null,
      identify: idIp?.toJSON() || null,
    };
  }

  /**
   * Create an Auth-type trunk.
   * Creates: ps_auths, ps_aors, ps_endpoints, ps_registrations.
   * Then triggers AMI PJSIPRegister to initiate outbound registration.
   */
  async createAuthTrunk(dto: CreateTrunkDto, vpbxUserUid: number, userId?: number) {
    const trunkId = this.buildTrunkId(dto.name, vpbxUserUid);
    await this.ensureUnique(trunkId);

    const context = this.buildContext(dto.context, vpbxUserUid);
    const serverUri = `sip:${dto.host}${dto.port ? `:${dto.port}` : ''}`;
    const clientUriDomain = dto.fromDomain || `${dto.host}${dto.port ? `:${dto.port}` : ''}`;
    const clientUri = `sip:${dto.username || trunkId}@${clientUriDomain}`;

    await this.sequelize.transaction(async (t) => {
      // 1. Auth
      await this.authModel.create(
        {
          id: trunkId,
          auth_type: 'userpass',
          username: dto.username || trunkId,
          password: dto.password || '',
        },
        { transaction: t },
      );

      // 2. AoR
      await this.aorModel.create(
        {
          id: trunkId,
          qualify_frequency: 60,
        },
        { transaction: t },
      );

      // 3. Registration (outbound)
      await this.registrationModel.create(
        {
          id: trunkId,
          server_uri: serverUri,
          client_uri: clientUri,
          outbound_auth: trunkId,
          contact_user: dto.contactUser || dto.username || trunkId,
          transport: dto.transport || null,
          endpoint: trunkId,
          retry_interval: 60,
          forbidden_retry_interval: 300,
          expiration: 3600,
          line: 'yes',
          type: 'registration',
        },
        { transaction: t },
      );

      // 4. Endpoint
      await this.endpointModel.create(
        {
          id: trunkId,
          tenantid: String(vpbxUserUid),
          auth: trunkId,
          aors: trunkId,
          context,
          disallow: 'all',
          allow: dto.codecs || 'ulaw,alaw,g722',
          transport: dto.transport || null,
          from_user: dto.fromUser || dto.username || '',
          from_domain: dto.fromDomain || dto.host || '',
          direct_media: 'no',
          dtmf_mode: 'auto',
          language: 'ru',
          ...(dto.advanced || {}),
        },
        { transaction: t },
      );
    });

    // Trigger AMI registration
    try {
      if (this.amiService.isConnected()) {
        // Reload the registration module so Asterisk picks up the new record
        await this.amiService.moduleReload('res_pjsip_outbound_registration.so');
        // Then register the specific trunk
        await this.amiService.pjsipRegister(trunkId);
        this.logger.log(`✅ AMI PJSIPRegister sent for ${trunkId}`);
      }
    } catch (e: any) {
      this.logger.warn(`AMI PJSIPRegister failed for ${trunkId}: ${e.message}`);
    }

    if (userId) {
      await this.loggerService.logAction(
        userId, 'create', 'trunk', null, vpbxUserUid,
        `Created auth trunk "${dto.name}" (${trunkId})`,
      );
    }

    return { id: trunkId, name: dto.name, trunkType: 'auth' as const };
  }

  /**
   * Create an IP-type trunk.
   * Creates: ps_aors, ps_endpoints, ps_endpoint_id_ips.
   * Then reloads the IP identifier module via AMI.
   */
  async createIpTrunk(dto: CreateTrunkDto, vpbxUserUid: number, userId?: number) {
    const trunkId = this.buildTrunkId(dto.name, vpbxUserUid);
    await this.ensureUnique(trunkId);

    const context = this.buildContext(dto.context, vpbxUserUid);
    const matchIp = dto.matchIp || dto.host;

    await this.sequelize.transaction(async (t) => {
      // 1. AoR
      await this.aorModel.create(
        {
          id: trunkId,
          qualify_frequency: 60,
        },
        { transaction: t },
      );

      // 2. Endpoint
      await this.endpointModel.create(
        {
          id: trunkId,
          tenantid: String(vpbxUserUid),
          aors: trunkId,
          context,
          disallow: 'all',
          allow: dto.codecs || 'ulaw,alaw,g722',
          transport: dto.transport || null,
          from_user: dto.fromUser || '',
          from_domain: dto.fromDomain || dto.host || '',
          direct_media: 'no',
          dtmf_mode: 'auto',
          language: 'ru',
          ...(dto.advanced || {}),
        },
        { transaction: t },
      );

      // 3. Identify by IP
      await this.endpointIdIpModel.create(
        {
          id: `${trunkId}_identify`,
          endpoint: trunkId,
          match: matchIp,
          type: 'identify',
        },
        { transaction: t },
      );
    });

    // Reload IP identifier module so Asterisk picks up changes
    try {
      if (this.amiService.isConnected()) {
        await this.amiService.moduleReload('res_pjsip_endpoint_identifier_ip.so');
        this.logger.log(`✅ AMI ModuleLoad reload sent for IP trunk ${trunkId}`);
      }
    } catch (e: any) {
      this.logger.warn(`AMI ModuleLoad reload failed for ${trunkId}: ${e.message}`);
    }

    if (userId) {
      await this.loggerService.logAction(
        userId, 'create', 'trunk', null, vpbxUserUid,
        `Created IP trunk "${dto.name}" (${trunkId})`,
      );
    }

    return { id: trunkId, name: dto.name, trunkType: 'ip' as const };
  }

  /**
   * Create a trunk (dispatches to Auth or IP creation).
   */
  async create(dto: CreateTrunkDto, vpbxUserUid: number, userId?: number) {
    if (dto.trunkType === 'auth') {
      return this.createAuthTrunk(dto, vpbxUserUid, userId);
    } else {
      return this.createIpTrunk(dto, vpbxUserUid, userId);
    }
  }

  /**
   * Update a trunk's configuration.
   */
  async update(trunkId: string, dto: UpdateTrunkDto, vpbxUserUid: number, userId?: number) {
    const existing = await this.endpointModel.findOne({
      where: { id: trunkId, tenantid: String(vpbxUserUid) },
    });
    if (!existing || !trunkId.startsWith('t_')) {
      throw new NotFoundException('Trunk not found');
    }

    const reg = await this.registrationModel.findByPk(trunkId);
    const isAuth = !!reg;

    await this.sequelize.transaction(async (t) => {
      // Update endpoint
      const endpointUpdate: any = {};
      if (dto.context) endpointUpdate.context = this.buildContext(dto.context, vpbxUserUid);
      if (dto.transport !== undefined) endpointUpdate.transport = dto.transport || null;
      if (dto.codecs) endpointUpdate.allow = dto.codecs;
      if (dto.fromUser !== undefined) endpointUpdate.from_user = dto.fromUser;
      if (dto.fromDomain !== undefined) endpointUpdate.from_domain = dto.fromDomain;
      if (dto.advanced) Object.assign(endpointUpdate, dto.advanced);

      if (Object.keys(endpointUpdate).length) {
        await this.endpointModel.update(endpointUpdate, {
          where: { id: trunkId },
          transaction: t,
        });
      }

      if (isAuth) {
        // Update auth
        const authUpdate: any = {};
        if (dto.username) authUpdate.username = dto.username;
        if (dto.password) authUpdate.password = dto.password;
        if (Object.keys(authUpdate).length) {
          await this.authModel.update(authUpdate, {
            where: { id: trunkId },
            transaction: t,
          });
        }

        // Update registration
        const regUpdate: any = {};
        
        const shouldUpdateUri = dto.host !== undefined || dto.port !== undefined || 
                                dto.username !== undefined || dto.fromDomain !== undefined;
                                
        if (shouldUpdateUri) {
          const currentHostWithPort = reg.server_uri.replace('sip:', '');
          const newHostWithPort = dto.host !== undefined 
            ? `${dto.host}${dto.port ? `:${dto.port}` : ''}` 
            : currentHostWithPort;
            
          regUpdate.server_uri = `sip:${newHostWithPort}`;
          
          const currentUsername = dto.username ?? (reg.client_uri?.match(/sip:(.*)@/)?.[1] || reg.outbound_auth || trunkId);
          const newDomain = dto.fromDomain !== undefined 
            ? (dto.fromDomain || newHostWithPort)
            : (existing.from_domain || newHostWithPort);
            
          regUpdate.client_uri = `sip:${currentUsername}@${newDomain}`;
        }
        
        if (dto.contactUser) regUpdate.contact_user = dto.contactUser;
        if (dto.transport !== undefined) regUpdate.transport = dto.transport || null;
        if (Object.keys(regUpdate).length) {
          await this.registrationModel.update(regUpdate, {
            where: { id: trunkId },
            transaction: t,
          });
        }
      } else {
        // Update identify
        if (dto.matchIp || dto.host) {
          await this.endpointIdIpModel.update(
            { match: dto.matchIp || dto.host },
            { where: { endpoint: trunkId }, transaction: t },
          );
        }
      }
    });

    // Trigger appropriate AMI reload
    try {
      if (this.amiService.isConnected()) {
        if (isAuth) {
          await this.amiService.moduleReload('res_pjsip_outbound_registration.so');
          await this.amiService.pjsipRegister(trunkId);
        } else {
          await this.amiService.moduleReload('res_pjsip_endpoint_identifier_ip.so');
        }
      }
    } catch (e: any) {
      this.logger.warn(`AMI reload failed after update of ${trunkId}: ${e.message}`);
    }

    if (userId) {
      await this.loggerService.logAction(
        userId, 'update', 'trunk', null, vpbxUserUid,
        `Updated trunk ${trunkId}`,
      );
    }

    return this.findOne(trunkId, vpbxUserUid);
  }

  /**
   * Delete a trunk and all its related PJSIP records.
   */
  async remove(trunkId: string, vpbxUserUid: number, userId?: number) {
    const existing = await this.endpointModel.findOne({
      where: { id: trunkId, tenantid: String(vpbxUserUid) },
    });
    if (!existing || !trunkId.startsWith('t_')) {
      throw new NotFoundException('Trunk not found');
    }

    const reg = await this.registrationModel.findByPk(trunkId);
    const isAuth = !!reg;

    // Unregister before deleting (for auth trunks)
    if (isAuth) {
      try {
        if (this.amiService.isConnected()) {
          await this.amiService.pjsipUnregister(trunkId);
        }
      } catch (e: any) {
        this.logger.warn(`AMI PJSIPUnregister failed for ${trunkId}: ${e.message}`);
      }
    }

    await this.sequelize.transaction(async (t) => {
      await this.registrationModel.destroy({ where: { id: trunkId }, transaction: t });
      await this.endpointIdIpModel.destroy({ where: { endpoint: trunkId }, transaction: t });
      await this.endpointModel.destroy({ where: { id: trunkId }, transaction: t });
      await this.authModel.destroy({ where: { id: trunkId }, transaction: t });
      await this.aorModel.destroy({ where: { id: trunkId }, transaction: t });
    });

    // Reload modules after deletion
    try {
      if (this.amiService.isConnected()) {
        if (isAuth) {
          await this.amiService.moduleReload('res_pjsip_outbound_registration.so');
        } else {
          await this.amiService.moduleReload('res_pjsip_endpoint_identifier_ip.so');
        }
      }
    } catch (e: any) {
      this.logger.warn(`AMI reload failed after deletion of ${trunkId}: ${e.message}`);
    }

    if (userId) {
      await this.loggerService.logAction(
        userId, 'delete', 'trunk', null, vpbxUserUid,
        `Deleted trunk ${trunkId}`,
      );
    }
  }

  /**
   * Delete multiple trunks.
   */
  async bulkRemove(trunkIds: string[], vpbxUserUid: number, userId?: number) {
    const results = await Promise.allSettled(
      trunkIds.map((id) => this.remove(id, vpbxUserUid, userId))
    );
    
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.error(`Failed to delete some trunks: ${failed.length} failed out of ${trunkIds.length}`);
      // Throw error if all failed or handle partial success
      if (failed.length === trunkIds.length) {
        throw new Error('Failed to delete any of the selected trunks');
      }
    }
    return { success: true, deleted: trunkIds.length - failed.length, failed: failed.length };
  }

  /** Extract display name from trunk ID (e.g. t_provider44_0 → provider44) */
  private extractTrunkName(trunkId: string, vpbxUserUid: number): string {
    const suffix = `_${vpbxUserUid}`;
    let name = trunkId;
    if (name.startsWith('t_')) name = name.slice(2);
    if (name.endsWith(suffix)) name = name.slice(0, -suffix.length);
    return name;
  }

  /** Strip tenant suffix from context for display */
  private stripContext(context: string | null, vpbxUserUid: number): string {
    if (!context) return '';
    const suffix = String(vpbxUserUid);
    if (context.endsWith(suffix)) return context.slice(0, -suffix.length);
    return context;
  }

  /** Ensure trunk ID is unique */
  private async ensureUnique(trunkId: string): Promise<void> {
    const exists = await this.endpointModel.findByPk(trunkId);
    if (exists) throw new ConflictException(`Trunk with this name already exists`);
  }
}
