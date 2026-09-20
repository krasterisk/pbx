"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PbxStateAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxStateAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const pbx_context_builder_service_1 = require("./pbx-context-builder.service");
/**
 * Platform-level compact PBX snapshot (D-15, D-27).
 *
 * One implementation behind the system prompt and get_pbx_state so they
 * cannot disagree about current tenant state. Replaces the first of the
 * eighteen handwritten tools that dumped every entity of five domains.
 */
let PbxStateAiAdapter = PbxStateAiAdapter_1 = class PbxStateAiAdapter {
    builder;
    registry;
    logger = new common_1.Logger(PbxStateAiAdapter_1.name);
    domain = 'pbx';
    constructor(builder, registry) {
        this.builder = builder;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('PbxStateAiAdapter registered');
    }
    getTools() {
        return [this.toolGetPbxState()];
    }
    toolGetPbxState() {
        return {
            name: 'get_pbx_state',
            description: 'Compact tenant PBX snapshot: per-domain counts and a bounded name sample. Optional domain filter (endpoints, trunks, ivrs, queues, contexts, adapters).',
            inputSchema: {
                domain: {
                    type: 'string',
                    description: 'Optional domain filter: endpoints | trunks | ivrs | queues | contexts | adapters',
                },
            },
            entityType: 'pbx',
            handler: async (args, vpbxUserUid) => {
                const state = await this.builder.buildState(vpbxUserUid);
                const snapshot = this.builder.toCompactSnapshot(state, typeof args.domain === 'string' ? args.domain : undefined);
                const encoded = JSON.stringify(snapshot);
                if (encoded.length > pbx_context_builder_service_1.STATE_SNAPSHOT_MAX_CHARS) {
                    return encoded.slice(0, pbx_context_builder_service_1.STATE_SNAPSHOT_MAX_CHARS - 16) + '[truncated]';
                }
                return snapshot;
            },
        };
    }
};
exports.PbxStateAiAdapter = PbxStateAiAdapter;
exports.PbxStateAiAdapter = PbxStateAiAdapter = PbxStateAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pbx_context_builder_service_1.PbxContextBuilderService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], PbxStateAiAdapter);
//# sourceMappingURL=pbx-state-ai.adapter.js.map