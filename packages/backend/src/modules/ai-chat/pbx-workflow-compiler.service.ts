import { Injectable, Logger } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  parseMutationArgs,
  parseMutationInput,
  stripTenantAliasesDeep,
} from '../ai-platform/ai-mutation.contract';
import { UserLevel } from '../users/user.model';

export interface DeclarativeWorkflowStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  dependsOn?: string[];
  label?: string;
}

export interface CompiledWorkflowStep {
  stepKey: string;
  tool: string;
  entityType: string;
  entityLabel: string;
  dependsOn: string[];
  canonicalArgs: Record<string, unknown>;
  schemaVersion: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  summary: string[];
  requiresSecureInput: boolean;
}

export interface CompiledWorkflow {
  title: string;
  summary: string[];
  steps: CompiledWorkflowStep[];
}

const FORBIDDEN_TOOLS = new Set([
  'create_tenant',
  'delete_tenant',
  'update_billing',
  'create_user_auth',
  'delete_audit',
  'set_provider_secret',
]);

/**
 * Accepts a declarative LLM draft, resolves only registered mutation tools,
 * rejects cycles / forbidden platform ops, and stamps canonical args.
 */
@Injectable()
export class PbxWorkflowCompilerService {
  private readonly logger = new Logger(PbxWorkflowCompilerService.name);

  constructor(private readonly registry: AiAdapterRegistryService) {}

  async compile(
    draft: { title?: string; steps: DeclarativeWorkflowStep[] },
    ctx: { vpbxUserUid: number; userUid: number; role: number },
  ): Promise<CompiledWorkflow> {
    if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
      throw new Error('WORKFLOW_EMPTY');
    }
    if (ctx.role === UserLevel.READONLY) {
      throw new Error('WORKFLOW_DENIED');
    }

    const keys = new Set<string>();
    for (const step of draft.steps) {
      if (!step.id || keys.has(step.id)) throw new Error(`WORKFLOW_BAD_STEP:${step.id || '(empty)'}`);
      keys.add(step.id);
      if (FORBIDDEN_TOOLS.has(step.tool)) throw new Error(`WORKFLOW_FORBIDDEN:${step.tool}`);
    }

    this.assertAcyclic(draft.steps);

    const compiled: CompiledWorkflowStep[] = [];
    const summary: string[] = [];

    for (const step of draft.steps) {
      const tool = this.registry.getMutationTool(step.tool);
      if (!tool) throw new Error(`WORKFLOW_UNKNOWN_TOOL:${step.tool}`);

      const input = parseMutationInput(tool.mutation, stripTenantAliasesDeep(step.args ?? {}));
      const proposed = await tool.mutation.propose(input, {
        vpbxUserUid: ctx.vpbxUserUid,
        userUid: ctx.userUid,
        role: ctx.role,
        isAdmin: ctx.role === UserLevel.ADMIN,
      });
      if ((proposed as { refused?: boolean }).refused) {
        throw new Error(`WORKFLOW_REFUSED:${step.tool}:${(proposed as any).message ?? 'refused'}`);
      }
      const proposal = proposed as {
        entityType: string;
        entityLabel: string;
        summary: string[];
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
        applyPayload: { args: Record<string, unknown> };
      };
      const canonicalArgs = parseMutationArgs(
        tool.mutation,
        stripTenantAliasesDeep(proposal.applyPayload?.args ?? {}),
      ) as Record<string, unknown>;

      compiled.push({
        stepKey: step.id,
        tool: step.tool,
        entityType: proposal.entityType || tool.entityType,
        entityLabel: step.label || proposal.entityLabel || step.tool,
        dependsOn: [...(step.dependsOn ?? [])],
        canonicalArgs,
        schemaVersion: tool.mutation.schemaVersion,
        before: proposal.before ?? null,
        after: proposal.after ?? null,
        summary: proposal.summary ?? [],
        requiresSecureInput: !!(canonicalArgs as any).requiresSecureInput,
      });
      summary.push(...(proposal.summary ?? [`${step.tool}`]));
    }

    this.logger.log(`compiled workflow steps=${compiled.length} tenant=${ctx.vpbxUserUid}`);
    return {
      title: draft.title?.trim() || compiled.map((s) => s.entityLabel).join(' → '),
      summary,
      steps: compiled,
    };
  }

  private assertAcyclic(steps: DeclarativeWorkflowStep[]): void {
    const byId = new Map(steps.map((s) => [s.id, s]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const walk = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`WORKFLOW_CYCLE:${id}`);
      visiting.add(id);
      const step = byId.get(id);
      for (const dep of step?.dependsOn ?? []) {
        if (!byId.has(dep)) throw new Error(`WORKFLOW_MISSING_DEP:${dep}`);
        walk(dep);
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const step of steps) walk(step.id);
  }
}
