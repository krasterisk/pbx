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
 *
 * Registration fails fast on a duplicate domain or tool name: a silently
 * overwritten adapter used to mean a mutation whose confirmation path resolved
 * to a different module's write.
 */
@Injectable()
export class AiAdapterRegistryService {
  private readonly logger = new Logger(AiAdapterRegistryService.name);
  private readonly adapters = new Map<string, DomainAiAdapter>();
  private readonly toolOwners = new Map<string, string>();

  register(adapter: DomainAiAdapter): void {
    if (this.adapters.has(adapter.domain)) {
      throw new Error(`AI adapter domain "${adapter.domain}" is already registered`);
    }
    const tools = adapter.getTools();
    for (const tool of tools) {
      const owner = this.toolOwners.get(tool.name);
      if (owner) {
        throw new Error(
          `AI tool "${tool.name}" is already registered by domain "${owner}" (duplicate in "${adapter.domain}")`,
        );
      }
    }
    for (const tool of tools) {
      this.toolOwners.set(tool.name, adapter.domain);
    }
    this.adapters.set(adapter.domain, adapter);
    this.logger.log(`Registered AI adapter for domain "${adapter.domain}" (${tools.length} tools)`);
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

  /**
   * Mutation executor lookup for the confirmation path. Returns undefined for
   * read-only tools and for a stored payload naming a tool that no longer
   * exists, so the confirmation refuses instead of guessing.
   */
  getMutationTool(name: string): (AiToolDefinition & { mutation: NonNullable<AiToolDefinition['mutation']> }) | undefined {
    const tool = this.getToolByName(name);
    if (!tool?.mutation) return undefined;
    return tool as AiToolDefinition & { mutation: NonNullable<AiToolDefinition['mutation']> };
  }

  /** Domain keys for the D-16/D-17 completeness gate (15-23). */
  getDomains(): string[] {
    return Array.from(this.adapters.keys());
  }
}
