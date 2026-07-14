/**
 * Domain AI Adapter contract (D-14): the platform-level "module -> AI" interface.
 *
 * Three components, per module that wants AI integration:
 *   - Tools:     AiToolDefinition[]  — single description consumed by both MCP and webhook dispatch
 *   - State:     AiStateProvider     — compact per-tenant summary aggregated into the system prompt
 *   - Knowledge: string              — compact static KB block aggregated into the system prompt
 *
 * Phonebooks is the reference implementation (D-15). The 5 existing domains
 * (endpoints/trunks/ivrs/queues/routes) are NOT migrated onto this contract in
 * this phase — they keep their hand-written McpToolsService.regXxx() methods —
 * but the registry/dispatch plumbing here must not break them.
 */

/**
 * A single AI-callable tool, dispatched identically through MCP `tools/call`
 * and the generic webhook `POST /api/ai-tools/call/:toolName`.
 *
 * `handler` receives `vpbxUserUid` as a call-time parameter — NEVER capture it
 * via closure at registration time (D-23: this was the cross-tenant bug in the
 * legacy MCP registry, where uid was baked into handlers at first-request time).
 */
export interface AiToolDefinition {
  /** snake_case tool name, unique across all adapters and legacy tools */
  name: string;
  /** Tool description, in the style of the 18 existing MCP tools (D-13) */
  description: string;
  /** Flat JSON-schema `properties` object — no separate metadata layer (D-13) */
  inputSchema: Record<string, any>;
  /** Entity type recorded in action_logs for this tool's calls (D-19) */
  entityType: string;
  /** Marks the tool as subject to the per-tenant confirmation gate (D-20/D-25) */
  destructive?: boolean;
  /** vpbxUserUid is passed as a call parameter — never closed over at registration */
  handler: (args: Record<string, any>, vpbxUserUid: number) => Promise<string | Record<string, any>>;
}

/** Per-tenant summary of a domain's state, folded into the AI system prompt (D-16). */
export interface AiStateProvider {
  /** Domain identifier, e.g. 'phonebooks' */
  domain: string;
  /** Compact text block — NOT full entity dumps (Pitfall 10 — context bloat) */
  buildSummary(vpbxUserUid: number): Promise<string>;
}

/** A domain module's full AI integration surface. */
export interface DomainAiAdapter {
  /** Domain identifier, unique across registered adapters */
  domain: string;
  getTools(): AiToolDefinition[];
  getStateProvider?(): AiStateProvider;
  /** Static knowledge block, 10-15 lines (D-16) */
  getKnowledgeBlock?(): string;
}
