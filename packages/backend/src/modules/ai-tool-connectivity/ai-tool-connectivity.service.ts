import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProductAccessService } from '../product-access/product-access.service';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { authorizeToolCall, DomainError, newToolId, schemaDigest } from './tool-gateway';
import { AiBusinessConnection, AiRobotToolBinding, AiToolRevision } from './tool.models';

@Injectable()
export class AiToolConnectivityService {
  constructor(
    private readonly products: ProductAccessService,
    @InjectModel(AiBusinessConnection) private readonly connections: typeof AiBusinessConnection,
    @InjectModel(AiToolRevision) private readonly revisions: typeof AiToolRevision,
    @InjectModel(AiRobotToolBinding) private readonly bindings: typeof AiRobotToolBinding,
  ) {}

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  async list(context: TenantContext) {
    return this.connections.findAll({ where: { tenant_uid: context.tenantUid } });
  }

  async create(context: TenantContext, body: { name: string; kind: string; destination: string }) {
    try {
      const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
      if (!access.allowed) throw new DomainError('entitlement', 403);
      return this.connections.create({
        id: newToolId(), tenant_uid: context.tenantUid, name: body.name, kind: body.kind,
        status: 'draft', draft_revision: 1, destination: body.destination,
        created_at: new Date(), updated_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  async publishTool(context: TenantContext, connectionId: string, schema: unknown, sideEffect: 'none' | 'read' | 'mutate') {
    try {
      const connection = await this.connections.findOne({
        where: { tenant_uid: context.tenantUid, id: connectionId },
      });
      if (!connection) throw new DomainError('resource_not_found', 404);
      const last = await this.revisions.findOne({
        where: { connection_id: connectionId }, order: [['revision', 'DESC']],
      });
      return this.revisions.create({
        id: newToolId(), tenant_uid: context.tenantUid, connection_id: connectionId,
        revision: (last?.revision ?? 0) + 1, schema_digest: schemaDigest(schema),
        schema_json: JSON.stringify(schema), side_effect: sideEffect, created_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  async bind(context: TenantContext, body: {
    robotVersionId: string; toolRevisionId: string; timeoutMs: number;
    policy: 'deny_mutate' | 'sandbox' | 'approved';
  }) {
    try {
      const revision = await this.revisions.findOne({
        where: { tenant_uid: context.tenantUid, id: body.toolRevisionId },
      });
      if (!revision) throw new DomainError('resource_not_found', 404);
      authorizeToolCall({
        tenantUid: context.tenantUid, robotVersionId: body.robotVersionId,
        toolRevisionId: body.toolRevisionId, sideEffect: revision.side_effect as 'none' | 'read' | 'mutate',
        policy: body.policy, simulated: false,
      });
      return this.bindings.create({
        tenant_uid: context.tenantUid, robot_version_id: body.robotVersionId,
        tool_revision_id: body.toolRevisionId, timeout_ms: body.timeoutMs,
        side_effect_policy: body.policy, created_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  probe(simulated: boolean) {
    return { sideEffects: simulated ? 'disabled' : 'sandbox_only', liveMcp: false };
  }
}
