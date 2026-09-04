import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AiToolDefinition, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
import { PbxContextBuilderService, STATE_SNAPSHOT_MAX_CHARS } from './pbx-context-builder.service';

/**
 * Platform-level compact PBX snapshot (D-15, D-27).
 *
 * One implementation behind the system prompt and get_pbx_state so they
 * cannot disagree about current tenant state. Replaces the first of the
 * eighteen handwritten tools that dumped every entity of five domains.
 */
@Injectable()
export class PbxStateAiAdapter implements DomainAiAdapter, OnModuleInit {
    private readonly logger = new Logger(PbxStateAiAdapter.name);
    readonly domain = 'pbx';

    constructor(
        private readonly builder: PbxContextBuilderService,
        private readonly registry: AiAdapterRegistryService,
    ) {}

    onModuleInit(): void {
        this.registry.register(this);
        this.logger.log('PbxStateAiAdapter registered');
    }

    getTools(): AiToolDefinition[] {
        return [this.toolGetPbxState()];
    }

    private toolGetPbxState(): AiToolDefinition {
        return {
            name: 'get_pbx_state',
            description:
                'Compact tenant PBX snapshot: per-domain counts and a bounded name sample. Optional domain filter (endpoints, trunks, ivrs, queues, contexts, adapters).',
            inputSchema: {
                domain: {
                    type: 'string',
                    description: 'Optional domain filter: endpoints | trunks | ivrs | queues | contexts | adapters',
                },
            },
            entityType: 'pbx',
            handler: async (args, vpbxUserUid) => {
                const state = await this.builder.buildState(vpbxUserUid);
                const snapshot = this.builder.toCompactSnapshot(
                    state,
                    typeof args.domain === 'string' ? args.domain : undefined,
                );
                const encoded = JSON.stringify(snapshot);
                if (encoded.length > STATE_SNAPSHOT_MAX_CHARS) {
                    return encoded.slice(0, STATE_SNAPSHOT_MAX_CHARS - 16) + '[truncated]';
                }
                return snapshot;
            },
        };
    }
}
