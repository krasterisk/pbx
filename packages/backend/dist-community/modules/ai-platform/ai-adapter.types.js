"use strict";
/**
 * Domain AI Adapter contract (D-14): the platform-level "module -> AI" interface.
 *
 * Three components, per module that wants AI integration:
 *   - Tools:     AiToolDefinition[]  — single description consumed by both MCP and webhook dispatch
 *   - State:     AiStateProvider     — compact per-tenant summary aggregated into the system prompt
 *   - Knowledge: string              — compact static KB block aggregated into the system prompt
 *
 * Directories is the reference implementation (D-15). The 5 existing domains
 * (endpoints/trunks/ivrs/queues/routes) are NOT migrated onto this contract in
 * this phase — they keep their hand-written McpToolsService.regXxx() methods —
 * but the registry/dispatch plumbing here must not break them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_ARG_KEYS = void 0;
/**
 * Keys a model must never be allowed to supply as tool arguments (D-22).
 * Stripped in McpToolsService.sanitizeArgs before any handler runs.
 */
exports.TENANT_ARG_KEYS = [
    'vpbxUserUid',
    'vpbx_user_uid',
    'userUid',
    'user_uid',
    'tenantId',
    'tenant_uid',
];
//# sourceMappingURL=ai-adapter.types.js.map