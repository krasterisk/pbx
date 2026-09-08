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

// Type-only: erased at compile time, so ai-mutation.contract stays the only
// runtime importer of this file and there is no module cycle.
import type { AiMutationContract } from './ai-mutation.contract';

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
  /**
   * Flat JSON-schema `properties` object — no separate metadata layer (D-13).
   * Read-only tools write this by hand. Mutating tools have it generated from
   * `mutation.input` by defineMutationTool, so the two cannot drift.
   */
  inputSchema: Record<string, any>;
  /** Entity type recorded in action_logs for this tool's calls (D-19) */
  entityType: string;
  /** Marks the tool as subject to the per-tenant confirmation gate (D-20/D-25) */
  destructive?: boolean;
  /** Handler returns an AgentDiffProposal; callTool persists it instead of writing (D-18) */
  proposes?: boolean;
  /**
   * Executable mutation contract. Present on every proposing tool: the strict
   * argument schemas, the revalidate/apply pair the confirmation path runs, and
   * the adapter-owned dialplan reload policy. Read-only tools leave it unset.
   */
  mutation?: AiMutationContract;
  /** vpbxUserUid is passed as a call parameter — never closed over at registration */
  handler: (
    args: Record<string, any>,
    vpbxUserUid: number,
    ctx?: { userUid: number; role: number; threadUid: number },
  ) => Promise<string | Record<string, any> | AgentDiffProposal>;
}

/**
 * Keys a model must never be allowed to supply as tool arguments (D-22).
 * Stripped in McpToolsService.sanitizeArgs before any handler runs.
 */
export const TENANT_ARG_KEYS = [
  'vpbxUserUid',
  'vpbx_user_uid',
  'userUid',
  'user_uid',
  'tenantId',
  'tenant_uid',
] as const;

/**
 * Server-side draft of a mutating tool result (D-18). Consumed by 15-05.
 *
 * `applyPayload` is server-side only and must never reach the model or the browser.
 */
export interface AgentDiffProposal {
  proposalId?: string;
  entityType: string;
  entityLabel: string;
  summary: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /**
   * Server-side only — must never reach the model or the browser.
   * `schemaVersion` is stamped by the dispatch layer from the registered
   * mutation, so a payload stored before a schema change is refused instead of
   * being applied against the new shape.
   */
  applyPayload: { tool: string; args: Record<string, unknown>; schemaVersion?: string };
  includesDialplanReload: boolean;
}

/** Per-tenant summary of a domain's state, folded into the AI system prompt (D-16). */
export interface AiStateProvider {
  /** Domain identifier, e.g. 'directories' */
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
