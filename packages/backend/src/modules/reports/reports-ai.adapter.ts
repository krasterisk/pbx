import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { CallsService } from './calls/calls.service';
import { callsAiTools, callsKnowledge } from './calls/calls-ai-tools';
import { callsAiResearchTools } from './calls/calls-ai-research-tools';
import { CallTextSearchService } from './calls/call-text-search.service';
import { CallAnalysisService } from './calls/call-analysis.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type {
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

@Injectable()
export class ReportsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(ReportsAiAdapter.name);
  readonly domain = 'reports';
  constructor(
    private readonly calls: CallsService,
    private readonly registry: AiAdapterRegistryService,
    @Optional() private readonly textSearch?: CallTextSearchService,
    @Optional() private readonly analysis?: CallAnalysisService,
  ) {}
  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ReportsAiAdapter registered');
  }
  getTools(): AiToolDefinition[] {
    return [...callsAiTools(this.calls), ...(this.textSearch && this.analysis ? callsAiResearchTools(this.calls,this.textSearch,this.analysis) : [])];
  }
  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }
  getKnowledgeBlock(): string {
    return callsKnowledge;
  }
}
