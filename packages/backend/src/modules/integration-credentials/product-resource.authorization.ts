import {
  ForbiddenException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import type { ProductResourceKind, ProductResourceReference, TenantContext } from './tenant-context';

export const PRODUCT_RESOURCE_RESOLVERS = Symbol('PRODUCT_RESOURCE_RESOLVERS');

export interface ProductResourceResolver {
  product: ProductResourceReference['product'];
  resourceKind: ProductResourceKind;
  /** Must use the supplied tenant UID in its SQL predicate. */
  findForTenant(tenantUid: number, resourceId: string): Promise<unknown | null>;
  canAct(context: TenantContext, action: string, resource: unknown): Promise<boolean>;
}

/** Runtime registry so product modules can register resolvers without a circular import. */
@Injectable()
export class ProductResourceResolverRegistry {
  private readonly items: ProductResourceResolver[] = [];

  register(resolver: ProductResourceResolver): void {
    if (!this.items.some((item) => item.product === resolver.product
      && item.resourceKind === resolver.resourceKind)) {
      this.items.push(resolver);
    }
  }

  all(): readonly ProductResourceResolver[] {
    return this.items;
  }
}

/** Default registry is empty until project/deployment modules provide resolvers. */
@Injectable()
export class ProductResourceAuthorization {
  constructor(
    @Inject(PRODUCT_RESOURCE_RESOLVERS) private readonly resolvers: readonly ProductResourceResolver[],
    private readonly registry: ProductResourceResolverRegistry,
  ) {}

  async authorize(context: TenantContext, reference: ProductResourceReference): Promise<void> {
    const validPair = (reference.product === 'speech_analytics' && reference.resourceKind === 'project')
      || (reference.product === 'ai_voice_robots' && reference.resourceKind === 'deployment');
    if (!validPair || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reference.resourceId)
      || !/^[a-z][a-z0-9:_-]{0,63}$/.test(reference.action)) {
      throw new NotFoundException({ code: 'resource_not_found' });
    }
    const resolver = [...this.resolvers, ...this.registry.all()].find((item) => item.product === reference.product
      && item.resourceKind === reference.resourceKind);
    if (!resolver) throw new NotFoundException({ code: 'resource_not_found' });
    const resource = await resolver.findForTenant(context.tenantUid, reference.resourceId);
    if (!resource) throw new NotFoundException({ code: 'resource_not_found' });
    if (!await resolver.canAct(context, reference.action, resource)) {
      throw new ForbiddenException({ code: 'resource_permission_denied' });
    }
  }
}
