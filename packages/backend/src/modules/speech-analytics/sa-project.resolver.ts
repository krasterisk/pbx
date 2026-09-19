import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  ProductResourceResolverRegistry,
  type ProductResourceResolver,
} from '../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../integration-credentials/tenant-context';
import { SaProject } from './speech-analytics.models';

@Injectable()
export class SaProjectResolver implements ProductResourceResolver, OnModuleInit {
  readonly product = 'speech_analytics' as const;
  readonly resourceKind = 'project' as const;

  constructor(
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    private readonly registry: ProductResourceResolverRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async findForTenant(tenantUid: number, resourceId: string): Promise<SaProject | null> {
    return this.projects.findOne({ where: { tenant_uid: tenantUid, id: resourceId } });
  }

  async canAct(context: TenantContext, action: string, resource: unknown): Promise<boolean> {
    const project = resource as SaProject;
    if (!project || project.tenant_uid !== context.tenantUid) return false;
    if (action === 'grant') return context.principalKind === 'user';
    if (project.status === 'archived' && action !== 'analytics:read') return false;
    return action.startsWith('analytics:');
  }
}
