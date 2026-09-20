import {
  ConflictException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { ProductAccessService } from '../product-access/product-access.service';
import { ProductResourceAuthorization } from '../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { DomainError } from './voice-engine';
import { AiRobotDeployment } from './ai-voice.models';
import {
  assertSipReady, evaluateSipProfile, hashInvocation, invocationReplay, newSipId,
} from './realtime-session';
import { AiSipConnection, AiVoiceInvocation } from './sip.models';

@Injectable()
export class AiSipService {
  constructor(
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
    @InjectModel(AiSipConnection) private readonly connections: typeof AiSipConnection,
    @InjectModel(AiVoiceInvocation) private readonly invocations: typeof AiVoiceInvocation,
    @InjectModel(AiRobotDeployment) private readonly deployments: typeof AiRobotDeployment,
  ) {}

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  async listConnections(context: TenantContext) {
    const rows = await this.connections.findAll({ where: { tenant_uid: context.tenantUid } });
    return rows.map((row) => {
      const profile = evaluateSipProfile({ transport: row.transport as 'udp' | 'tcp' | 'tls' });
      return { ...row.toJSON(), status: profile.status, reason: profile.reason, ready: profile.ready };
    });
  }

  async createConnection(context: TenantContext, body: { name: string; transport: 'udp' | 'tcp' | 'tls' }) {
    try {
      const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
      if (!access.allowed) throw new DomainError('entitlement', 403);
      const profile = evaluateSipProfile({ transport: body.transport });
      const row = await this.connections.create({
        id: newSipId(), tenant_uid: context.tenantUid, name: body.name,
        status: profile.status === 'disabled' ? 'failed' : profile.status,
        transport: body.transport, auth_kind: 'digest', draft_revision: 1, secret_once_shown: false,
        created_at: new Date(), updated_at: new Date(),
      });
      return { ...row.toJSON(), status: profile.status, reason: profile.reason, ready: profile.ready };
    } catch (error) { this.mapError(error); }
  }

  async showSecretOnce(context: TenantContext, id: string) {
    try {
      const row = await this.connections.findOne({ where: { tenant_uid: context.tenantUid, id } });
      if (!row) throw new NotFoundException({ code: 'resource_not_found' });
      if (row.secret_once_shown) throw new DomainError('secret_already_shown', 409);
      await row.update({ secret_once_shown: true });
      return { id: row.id, secret: `sip-once-${row.id.slice(0, 8)}` };
    } catch (error) { this.mapError(error); }
  }

  async invoke(context: TenantContext, body: {
    deploymentId: string; externalCallId: string; destinationRef: string; payload: unknown;
  }) {
    try {
      await this.resources.authorize(context, {
        product: 'ai_voice_robots', action: 'voice:invoke', resourceKind: 'deployment',
        resourceId: body.deploymentId,
      });
      const deployment = await this.deployments.findOne({
        where: { tenant_uid: context.tenantUid, id: body.deploymentId },
      });
      if (!deployment) throw new NotFoundException({ code: 'resource_not_found' });
      assertSipReady({
        kind: deployment.kind,
        appliedRevision: false,
      });
      const requestHash = hashInvocation(body.payload);
      const existing = await this.invocations.findOne({
        where: {
          tenant_uid: context.tenantUid, principal: context.principalId,
          deployment_id: body.deploymentId, external_call_id: body.externalCallId,
        },
      });
      if (existing) {
        if (invocationReplay(existing.request_hash, requestHash) === 'replay') return { ...existing.toJSON(), replay: true };
      }
      try {
        return await this.invocations.create({
          id: newSipId(), tenant_uid: context.tenantUid, deployment_id: body.deploymentId,
          principal: context.principalId, external_call_id: body.externalCallId, request_hash: requestHash,
          status: 'accepted', destination_ref: body.destinationRef, created_at: new Date(),
        });
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          throw new ConflictException({ code: 'invocation_conflict' });
        }
        throw error;
      }
    } catch (error) { this.mapError(error); }
  }

  drain(): { admissionsStopped: true; liveSip: false } {
    return { admissionsStopped: true, liveSip: false };
  }
}
