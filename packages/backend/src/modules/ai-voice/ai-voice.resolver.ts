import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  ProductResourceResolverRegistry,
  type ProductResourceResolver,
} from '../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { AiRobotDeployment } from './ai-voice.models';

@Injectable()
export class AiVoiceDeploymentResolver implements ProductResourceResolver, OnModuleInit {
  readonly product = 'ai_voice_robots' as const;
  readonly resourceKind = 'deployment' as const;

  constructor(
    @InjectModel(AiRobotDeployment) private readonly deployments: typeof AiRobotDeployment,
    private readonly registry: ProductResourceResolverRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async findForTenant(tenantUid: number, resourceId: string): Promise<AiRobotDeployment | null> {
    return this.deployments.findOne({ where: { tenant_uid: tenantUid, id: resourceId } });
  }

  async canAct(context: TenantContext, action: string, resource: unknown): Promise<boolean> {
    const deployment = resource as AiRobotDeployment;
    if (!deployment || deployment.tenant_uid !== context.tenantUid) return false;
    if (action === 'grant') return context.principalKind === 'user';
    return action.startsWith('robots:');
  }
}
