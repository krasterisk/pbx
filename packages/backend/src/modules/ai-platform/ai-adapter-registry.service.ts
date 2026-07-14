import { Injectable, Logger } from '@nestjs/common';
import { AiToolDefinition, AiStateProvider, DomainAiAdapter } from './ai-adapter.types';

/**
 * AiAdapterRegistryService — central registry of Domain AI Adapters (D-14).
 *
 * Adapters register themselves explicitly via OnModuleInit (see
 * PhonebooksAiAdapter) rather than being auto-discovered — simpler and more
 * predictable than a DiscoveryService scan, and avoids a new dependency.
 *
 * The registry itself holds no per-tenant state: `getAllTools()` returns
 * handler functions that take `vpbxUserUid` as a call parameter (D-23).
 */
@Injectable()
export class AiAdapterRegistryService {
  private readonly logger = new Logger(AiAdapterRegistryService.name);
  private readonly adapters = new Map<string, DomainAiAdapter>();

  register(adapter: DomainAiAdapter): void {
    this.adapters.set(adapter.domain, adapter);
    this.logger.log(`Registered AI adapter for domain "${adapter.domain}" (${adapter.getTools().length} tools)`);
  }

  getAllTools(): AiToolDefinition[] {
    return Array.from(this.adapters.values()).flatMap((a) => a.getTools());
  }

  getStateProviders(): AiStateProvider[] {
    return Array.from(this.adapters.values())
      .map((a) => a.getStateProvider?.())
      .filter((p): p is AiStateProvider => !!p);
  }

  getKnowledgeBlocks(): string[] {
    return Array.from(this.adapters.values())
      .map((a) => a.getKnowledgeBlock?.())
      .filter((k): k is string => !!k);
  }

  getToolByName(name: string): AiToolDefinition | undefined {
    return this.getAllTools().find((t) => t.name === name);
  }
}
