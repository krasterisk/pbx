import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MohService } from './moh.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

/**
 * Stub for 15-13 Task 2 RED — tools land in the GREEN commit.
 */
@Injectable()
export class MohAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(MohAiAdapter.name);
  readonly domain = 'moh';

  constructor(
    private readonly mohService: MohService,
    private readonly registry: AiAdapterRegistryService,
    private readonly queuesService: QueuesService,
    private readonly routesService: RoutesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('MohAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }
}
