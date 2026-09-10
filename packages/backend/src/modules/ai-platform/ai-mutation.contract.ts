import { z } from 'zod';
import { AgentDiffProposal, AiToolDefinition, TENANT_ARG_KEYS } from './ai-adapter.types';

/**
 * Executable mutation contract (schema / propose / revalidate / apply).
 *
 * Before this contract a mutating tool described its arguments twice: a
 * hand-written JSON-schema fragment for the model, and a hand-written `switch`
 * in PbxAgentDiffService that decided how to write them. The two drifted —
 * `assign_moh_class` proposed a change nothing could apply, and `update_route`
 * had an apply branch no tool produced.
 *
 * Now one adapter object owns all four sides of a mutation:
 *   - `input`  — strict zod schema for model-supplied arguments. The MCP/OpenAI
 *                JSON schema is generated from this same object.
 *   - `propose`— builds the confirmation card and the canonical server args.
 *   - `args`   — strict zod schema for those canonical args, re-parsed at confirm.
 *   - `revalidate` — re-checks the canonical args against fresh tenant state.
 *   - `apply`  — performs the tenant write, exactly once per proposal.
 *   - `reload` — dialplan reload policy, owned by the adapter, never by the model.
 */

/** Entities promised by earlier steps of the same workflow draft. */
export interface PlannedWorkflowEntities {
  extensions: string[];
  groups: Array<{ name?: string; exten?: string }>;
  queues: Array<{ name?: string; exten?: string }>;
}

/** Tenant identity for a mutation. Always derived from JWT/dispatch, never from arguments. */
export interface AiMutationContext {
  vpbxUserUid: number;
  userUid: number;
  role: number;
  isAdmin: boolean;
  planned?: PlannedWorkflowEntities;
}

/** Refusal shape adapters already return from propose (rendered as text, no card). */
export interface AiToolRefusal {
  refused: true;
  [key: string]: unknown;
}

/** Step is a no-op (e.g. all named subscribers already exist). No card, workflow continues. */
export interface AiToolSkip {
  skipped: true;
  message?: string;
  [key: string]: unknown;
}

export type MutationRevalidation<TArgs> =
  | { ok: true; args: TArgs }
  | { ok: false; reason: string };

/**
 * What confirming this mutation implies for the running dialplan.
 * `dialplan-context` reloads exactly one context, resolved from canonical args.
 */
export type MutationReloadPolicy =
  | { kind: 'none' }
  | { kind: 'dialplan-context'; contextUid: (args: any) => number };

export interface AiMutationContract<TInput = any, TArgs = any> {
  /** Bumped when the canonical args shape changes; stale stored payloads are refused. */
  schemaVersion: string;
  input: z.ZodType<TInput>;
  args: z.ZodType<TArgs>;
  reload: MutationReloadPolicy;
  propose(input: TInput, ctx: AiMutationContext): Promise<AgentDiffProposal | AiToolRefusal | AiToolSkip>;
  revalidate(args: TArgs, ctx: AiMutationContext): Promise<MutationRevalidation<TArgs>>;
  apply(args: TArgs, ctx: AiMutationContext): Promise<void>;
}

export interface MutationToolSpec<TInput, TArgs> extends AiMutationContract<TInput, TArgs> {
  name: string;
  description: string;
  entityType: string;
  destructive?: boolean;
}

export type ToolJsonSchema = {
  type: 'object';
  properties: Record<string, any>;
  required: string[];
  additionalProperties: false;
};

/** Recognized as "an object literal", as opposed to an array or a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStrictObjectSchema(schema: z.ZodType): boolean {
  const def = (schema as unknown as { _zod?: { def?: { type?: string; catchall?: unknown } } })._zod?.def;
  if (def?.type !== 'object') return false;
  const catchall = def.catchall as { _zod?: { def?: { type?: string } } } | undefined;
  return catchall?._zod?.def?.type === 'never';
}

/**
 * JSON schema for the model, generated from the executable schema so the two
 * cannot describe different arguments.
 */
export function jsonSchemaOf(schema: z.ZodType): ToolJsonSchema {
  const generated = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' }) as Record<string, any>;
  return {
    type: 'object',
    properties: (generated.properties ?? {}) as Record<string, any>,
    required: (generated.required ?? []) as string[],
    additionalProperties: false,
  };
}

/**
 * D-22, recursive: a strict top-level schema stops a forged `vpbxUserUid` at the
 * root, but dialplan params are deliberately open records. Reject a tenant alias
 * wherever it hides instead of hoping the leaf schema catches it.
 */
export function assertNoTenantAliases(value: unknown, path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoTenantAliases(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if ((TENANT_ARG_KEYS as readonly string[]).includes(key)) {
      throw new Error(`TENANT_ARG_FORBIDDEN:${path ? `${path}.` : ''}${key}`);
    }
    assertNoTenantAliases(child, path ? `${path}.${key}` : key);
  }
}

/** Copy without any tenant alias, at any depth. Used on stored payloads, which predate this contract. */
export function stripTenantAliasesDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripTenantAliasesDeep(item)) as unknown as T;
  }
  if (!isPlainObject(value)) return value;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if ((TENANT_ARG_KEYS as readonly string[]).includes(key)) continue;
    clean[key] = stripTenantAliasesDeep(child);
  }
  return clean as unknown as T;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.join('.');
      const keys = (issue as { keys?: string[] }).keys;
      const subject = keys?.length ? keys.join(', ') : where;
      return subject ? `${subject}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/** Strict parse of model-supplied arguments. Unknown and missing properties both fail. */
export function parseMutationInput<TInput>(
  mutation: AiMutationContract<TInput, any>,
  raw: unknown,
): TInput {
  assertNoTenantAliases(raw);
  const parsed = mutation.input.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new Error(`ARGS_INVALID: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

/** Strict parse of the canonical server args stored in `applyPayload`. */
export function parseMutationArgs<TArgs>(
  mutation: AiMutationContract<any, TArgs>,
  raw: unknown,
): TArgs {
  const parsed = mutation.args.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new Error(`APPLY_ARGS_INVALID: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function isToolRefusal(value: unknown): value is AiToolRefusal {
  return isPlainObject(value) && value.refused === true;
}

export function isToolSkip(value: unknown): value is AiToolSkip {
  return isPlainObject(value) && value.skipped === true;
}

/**
 * Builds the AiToolDefinition a mutation adapter registers. `inputSchema` is
 * generated here rather than written by hand, so the model can never be offered
 * a property the executable schema rejects.
 */
export function defineMutationTool<TInput, TArgs>(
  spec: MutationToolSpec<TInput, TArgs>,
): AiToolDefinition {
  if (!isStrictObjectSchema(spec.input)) {
    throw new Error(`${spec.name}: input must be a strict zod object (z.strictObject)`);
  }
  if (!isStrictObjectSchema(spec.args)) {
    throw new Error(`${spec.name}: args must be a strict zod object (z.strictObject)`);
  }

  const mutation: AiMutationContract<TInput, TArgs> = {
    schemaVersion: spec.schemaVersion,
    input: spec.input,
    args: spec.args,
    reload: spec.reload,
    propose: spec.propose,
    revalidate: spec.revalidate,
    apply: spec.apply,
  };

  return {
    name: spec.name,
    description: spec.description,
    entityType: spec.entityType,
    destructive: spec.destructive,
    proposes: true,
    inputSchema: jsonSchemaOf(spec.input).properties,
    mutation,
    /**
     * Compatibility entry point. Dispatch calls `mutation.propose` directly with
     * the real caller context; this shim exists for callers that only hold an
     * AiToolDefinition. It parses first so there is no route to `propose` that
     * skips the executable schema.
     */
    handler: async (args, vpbxUserUid) => {
      const input = parseMutationInput(mutation, args);
      const proposed = await mutation.propose(input, {
        vpbxUserUid,
        userUid: 0,
        role: 0,
        isAdmin: false,
      });
      return proposed as Record<string, any>;
    },
  };
}
