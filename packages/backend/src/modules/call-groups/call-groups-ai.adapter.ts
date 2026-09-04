import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CallGroupsService } from './call-groups.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/**
 * Stub for 15-13 Task 1 RED — tools land in the GREEN commit.
 */
@Injectable()
export class CallGroupsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(CallGroupsAiAdapter.name);
  readonly domain = 'call-groups';

  constructor(
    private readonly callGroupsService: CallGroupsService,
    private readonly registry: AiAdapterRegistryService,
    private readonly endpointsService: EndpointsService,
    private readonly routeReferencesService: RouteReferencesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('CallGroupsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }
}
