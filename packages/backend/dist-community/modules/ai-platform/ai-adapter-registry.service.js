"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AiAdapterRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAdapterRegistryService = void 0;
const common_1 = require("@nestjs/common");
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
let AiAdapterRegistryService = AiAdapterRegistryService_1 = class AiAdapterRegistryService {
    logger = new common_1.Logger(AiAdapterRegistryService_1.name);
    adapters = new Map();
    toolOwners = new Map();
    register(adapter) {
        if (this.adapters.has(adapter.domain)) {
            throw new Error(`AI adapter domain "${adapter.domain}" is already registered`);
        }
        const tools = adapter.getTools();
        for (const tool of tools) {
            const owner = this.toolOwners.get(tool.name);
            if (owner) {
                throw new Error(`AI tool "${tool.name}" is already registered by domain "${owner}" (duplicate in "${adapter.domain}")`);
            }
        }
        for (const tool of tools) {
            this.toolOwners.set(tool.name, adapter.domain);
        }
        this.adapters.set(adapter.domain, adapter);
        this.logger.log(`Registered AI adapter for domain "${adapter.domain}" (${tools.length} tools)`);
    }
    getAllTools() {
        return Array.from(this.adapters.values()).flatMap((a) => a.getTools());
    }
    getStateProviders() {
        return Array.from(this.adapters.values())
            .map((a) => a.getStateProvider?.())
            .filter((p) => !!p);
    }
    getKnowledgeBlocks() {
        return Array.from(this.adapters.values())
            .map((a) => a.getKnowledgeBlock?.())
            .filter((k) => !!k);
    }
    getToolByName(name) {
        return this.getAllTools().find((t) => t.name === name);
    }
    /**
     * Mutation executor lookup for the confirmation path. Returns undefined for
     * read-only tools and for a stored payload naming a tool that no longer
     * exists, so the confirmation refuses instead of guessing.
     */
    getMutationTool(name) {
        const tool = this.getToolByName(name);
        if (!tool?.mutation)
            return undefined;
        return tool;
    }
    /** Domain keys for the D-16/D-17 completeness gate (15-23). */
    getDomains() {
        return Array.from(this.adapters.keys());
    }
};
exports.AiAdapterRegistryService = AiAdapterRegistryService;
exports.AiAdapterRegistryService = AiAdapterRegistryService = AiAdapterRegistryService_1 = __decorate([
    (0, common_1.Injectable)()
], AiAdapterRegistryService);
//# sourceMappingURL=ai-adapter-registry.service.js.map