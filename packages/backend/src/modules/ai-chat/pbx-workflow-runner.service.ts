import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { parseMutationArgs, stripTenantAliasesDeep } from '../ai-platform/ai-mutation.contract';
import { UserLevel } from '../users/user.model';
import { RouteApplyService } from '../routes/route-apply.service';
import {
  AgentWorkflow,
  AgentWorkflowStep,
  type AgentWorkflowStatus,
} from './models/agent-workflow.model';
import { AgentThread } from './models/agent-thread.model';
import {
  PbxWorkflowCompilerService,
  type CompiledWorkflow,
  type DeclarativeWorkflowStep,
} from './pbx-workflow-compiler.service';
import type { ProposalContext } from './pbx-agent-diff.service';

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface WorkflowStepView {
  stepKey: string;
  stepIndex: number;
  tool: string;
  entityType: string;
  entityLabel: string;
  status: string;
  error: string | null;
  dependsOn: string[];
  requiresSecureInput: boolean;
}

export interface WorkflowPlanView {
  workflowId: string;
  threadUid: number;
  title: string;
  summary: string[];
  status: AgentWorkflowStatus;
  error: string | null;
  expiresAt: string;
  appliedAt: string | null;
  steps: WorkflowStepView[];
}

@Injectable()
export class PbxWorkflowRunnerService {
  private readonly logger = new Logger(PbxWorkflowRunnerService.name);
  private readonly locks = new Set<string>();

  constructor(
    @InjectModel(AgentWorkflow) private readonly workflowModel: typeof AgentWorkflow,
    @InjectModel(AgentWorkflowStep) private readonly stepModel: typeof AgentWorkflowStep,
    private readonly compiler: PbxWorkflowCompilerService,
    private readonly registry: AiAdapterRegistryService,
    private readonly routeApply: RouteApplyService,
    @InjectModel(AgentThread) private readonly threadModel: typeof AgentThread,
  ) {}

  async findLatestPendingForThread(
    threadUid: number,
    ctx: ProposalContext,
  ): Promise<WorkflowPlanView | null> {
    if (threadUid <= 0) return null;
    const row = await this.workflowModel.findOne({
      where: {
        thread_uid: threadUid,
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
        status: { [Op.in]: ['pending', 'failed'] },
      },
      order: [['created_at', 'DESC']],
    });
    if (!row) return null;
    const steps = await this.stepModel.findAll({
      where: { workflow_uid: row.uid },
      order: [['step_index', 'ASC']],
    });
    return this.toView(row, steps);
  }

  async createFromDraft(
    draft: { title?: string; steps: DeclarativeWorkflowStep[] },
    ctx: ProposalContext & { briefVersion?: number },
  ): Promise<WorkflowPlanView> {
    const compiled = await this.compiler.compile(draft, ctx);
    return this.persistCompiled(compiled, ctx);
  }

  async createFromCompiled(
    compiled: CompiledWorkflow,
    ctx: ProposalContext & { briefVersion?: number },
  ): Promise<WorkflowPlanView> {
    return this.persistCompiled(compiled, ctx);
  }

  async getOwned(workflowId: string, ctx: ProposalContext): Promise<WorkflowPlanView> {
    const row = await this.findOwned(workflowId, ctx);
    if (!row) throw new NotFoundException('Workflow not found');
    const steps = await this.stepModel.findAll({
      where: { workflow_uid: row.uid },
      order: [['step_index', 'ASC']],
    });
    return this.toView(row, steps);
  }

  async reject(workflowId: string, ctx: ProposalContext): Promise<WorkflowPlanView> {
    const row = await this.findOwned(workflowId, ctx);
    if (!row || row.status !== 'pending') {
      throw new NotFoundException('Workflow not pending');
    }
    await row.update({ status: 'rejected', updated_at: new Date() });
    const steps = await this.stepModel.findAll({
      where: { workflow_uid: row.uid },
      order: [['step_index', 'ASC']],
    });
    return this.toView(row, steps);
  }

  /**
   * Staged apply under an in-process lock. Stops on the first failure and leaves
   * remaining steps pending. Does not promise atomicity across DB/AMI/external.
   */
  async apply(workflowId: string, ctx: ProposalContext): Promise<WorkflowPlanView> {
    if (this.locks.has(workflowId)) {
      throw new Error('WORKFLOW_BUSY');
    }
    this.locks.add(workflowId);
    try {
      const row = await this.findOwned(workflowId, ctx);
      if (!row) throw new NotFoundException('Workflow not found');
      if (row.status !== 'pending' && row.status !== 'failed') {
        return this.getOwned(workflowId, ctx);
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await row.update({ status: 'expired', updated_at: new Date() });
        return this.getOwned(workflowId, ctx);
      }
      if (ctx.role === UserLevel.READONLY) {
        await row.update({ status: 'denied', updated_at: new Date() });
        return this.getOwned(workflowId, ctx);
      }

      await row.update({ status: 'applying', error: null, updated_at: new Date() });
      const steps = await this.stepModel.findAll({
        where: { workflow_uid: row.uid },
        order: [['step_index', 'ASC']],
      });
      const results = new Map<string, Record<string, unknown>>();

      for (const step of steps) {
        if (step.status === 'applied') {
          if (step.result_json) results.set(step.step_key, step.result_json);
          continue;
        }
        if (step.status === 'skipped') continue;

        const depsOk = (step.depends_on ?? []).every((dep) => {
          const depStep = steps.find((s) => s.step_key === dep);
          return depStep?.status === 'applied';
        });
        if (!depsOk) {
          await step.update({
            status: 'failed',
            error: 'dependency not applied',
            updated_at: new Date(),
          });
          await row.update({
            status: 'failed',
            error: `step ${step.step_key}: dependency not applied`,
            updated_at: new Date(),
          });
          break;
        }

        await step.update({ status: 'applying', attempts: step.attempts + 1, updated_at: new Date() });
        try {
          const resolvedArgs = this.resolveSymbolicArgs(step.canonical_args, results);
          const tool = this.registry.getMutationTool(step.tool);
          if (!tool) throw new Error(`unknown tool ${step.tool}`);
          if (step.schema_version !== tool.mutation.schemaVersion) {
            throw new Error(`stale schema ${step.schema_version}`);
          }
          const args = parseMutationArgs(tool.mutation, stripTenantAliasesDeep(resolvedArgs));
          const mutationCtx = {
            vpbxUserUid: ctx.vpbxUserUid,
            userUid: ctx.userUid,
            role: ctx.role,
            isAdmin: ctx.role === UserLevel.ADMIN,
          };
          const check = await tool.mutation.revalidate(args, mutationCtx);
          if (!check.ok) throw new Error(check.reason);
          await tool.mutation.apply(check.args, mutationCtx);
          if (tool.mutation.reload.kind === 'dialplan-context') {
            const contextUid = tool.mutation.reload.contextUid(check.args);
            await this.routeApply.applyContext(contextUid, ctx.vpbxUserUid, {
              userUid: ctx.userUid,
            } as any);
          }
          const result = {
            ...(typeof check.args === 'object' && check.args ? (check.args as object) : {}),
            applied: true,
          };
          results.set(step.step_key, result as Record<string, unknown>);
          await step.update({
            status: 'applied',
            result_json: result as Record<string, unknown>,
            error: null,
            updated_at: new Date(),
          });
        } catch (err: any) {
          const message = err?.message ?? String(err);
          await step.update({ status: 'failed', error: message, updated_at: new Date() });
          await row.update({
            status: 'failed',
            error: `step ${step.step_key}: ${message}`,
            updated_at: new Date(),
          });
          this.logger.warn(`workflow ${workflowId} stopped at ${step.step_key}: ${message}`);
          break;
        }
      }

      const fresh = await this.stepModel.findAll({
        where: { workflow_uid: row.uid },
        order: [['step_index', 'ASC']],
      });
      const allApplied = fresh.every((s) => s.status === 'applied' || s.status === 'skipped');
      if (allApplied) {
        await row.update({ status: 'applied', applied_at: new Date(), error: null, updated_at: new Date() });
      }
      return this.toView(await row.reload(), fresh);
    } finally {
      this.locks.delete(workflowId);
    }
  }

  private async persistCompiled(
    compiled: CompiledWorkflow,
    ctx: ProposalContext & { briefVersion?: number },
  ): Promise<WorkflowPlanView> {
    const now = new Date();
    const threadUid = ctx.threadUid ?? 0;
    if (threadUid > 0) {
      await this.workflowModel.update(
        { status: 'rejected', error: 'superseded', updated_at: now },
        {
          where: {
            thread_uid: threadUid,
            vpbx_user_uid: ctx.vpbxUserUid,
            user_uid: ctx.userUid,
            status: { [Op.in]: ['pending', 'failed'] },
          },
        },
      );
    }
    const workflow = await this.workflowModel.create({
      workflow_id: randomUUID(),
      thread_uid: ctx.threadUid ?? 0,
      vpbx_user_uid: ctx.vpbxUserUid,
      user_uid: ctx.userUid,
      brief_version: ctx.briefVersion ?? 0,
      title: compiled.title,
      summary: compiled.summary,
      status: 'pending',
      error: null,
      expires_at: new Date(now.getTime() + EXPIRY_MS),
      applied_at: null,
      created_at: now,
      updated_at: now,
    });

    const steps = await Promise.all(
      compiled.steps.map((step, index) =>
        this.stepModel.create({
          workflow_uid: workflow.uid,
          step_key: step.stepKey,
          step_index: index,
          tool: step.tool,
          entity_type: step.entityType,
          entity_label: step.entityLabel,
          depends_on: step.dependsOn,
          canonical_args: step.canonicalArgs,
          schema_version: step.schemaVersion,
          before_json: step.before,
          after_json: step.after,
          result_json: null,
          status: 'pending',
          attempts: 0,
          error: null,
          requires_secure_input: step.requiresSecureInput,
          created_at: now,
          updated_at: now,
        }),
      ),
    );

    return this.toView(workflow, steps);
  }

  private resolveSymbolicArgs(
    args: Record<string, unknown>,
    results: Map<string, Record<string, unknown>>,
  ): Record<string, unknown> {
    const rewrite = (value: unknown): unknown => {
      if (typeof value === 'string') {
        const match = /^steps\.([^.]+)\.result\.(.+)$/.exec(value);
        if (match) {
          const [, stepKey, path] = match;
          const result = results.get(stepKey);
          if (!result) throw new Error(`unresolved symbolic ref ${value}`);
          const parts = path.split('.');
          let cur: any = result;
          for (const part of parts) {
            cur = cur?.[part];
          }
          return cur;
        }
        return value;
      }
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, rewrite(v)]),
        );
      }
      return value;
    };
    return rewrite(args) as Record<string, unknown>;
  }

  private async findOwned(workflowId: string, ctx: ProposalContext): Promise<AgentWorkflow | null> {
    return this.workflowModel.findOne({
      where: {
        workflow_id: workflowId,
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
      },
    });
  }

  private toView(row: AgentWorkflow, steps: AgentWorkflowStep[]): WorkflowPlanView {
    return {
      workflowId: row.workflow_id,
      threadUid: Number(row.thread_uid),
      title: row.title,
      summary: row.summary ?? [],
      status: row.status,
      error: row.error,
      expiresAt: new Date(row.expires_at).toISOString(),
      appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
      steps: steps.map((step) => ({
        stepKey: step.step_key,
        stepIndex: step.step_index,
        tool: step.tool,
        entityType: step.entity_type,
        entityLabel: step.entity_label,
        status: step.status,
        error: step.error,
        dependsOn: step.depends_on ?? [],
        requiresSecureInput: !!step.requires_secure_input,
      })),
    };
  }

  async listPending(ctx: ProposalContext): Promise<WorkflowPlanView[]> {
    const rows = await this.workflowModel.findAll({
      where: {
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
        status: { [Op.in]: ['pending', 'failed', 'applying'] },
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['created_at', 'DESC']],
    });
    const threadUids = [...new Set(rows.map((row) => Number(row.thread_uid)).filter((uid) => uid > 0))];
    const living = threadUids.length
      ? await this.threadModel.findAll({
          where: {
            uid: { [Op.in]: threadUids },
            vpbx_user_uid: ctx.vpbxUserUid,
            user_uid: ctx.userUid,
          },
          attributes: ['uid'],
        })
      : [];
    const livingSet = new Set(living.map((row) => Number(row.uid)));
    const orphanUids = rows
      .filter((row) => !livingSet.has(Number(row.thread_uid)))
      .map((row) => row.uid);
    if (orphanUids.length) {
      await this.stepModel.destroy({ where: { workflow_uid: { [Op.in]: orphanUids } } });
      await this.workflowModel.destroy({ where: { uid: { [Op.in]: orphanUids } } });
    }
    const views: WorkflowPlanView[] = [];
    for (const row of rows) {
      if (!livingSet.has(Number(row.thread_uid))) continue;
      const steps = await this.stepModel.findAll({
        where: { workflow_uid: row.uid },
        order: [['step_index', 'ASC']],
      });
      views.push(this.toView(row, steps));
    }
    return views;
  }

  async deleteForThread(threadUid: number, ctx: ProposalContext): Promise<void> {
    const rows = await this.workflowModel.findAll({
      where: {
        thread_uid: threadUid,
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
      },
    });
    const uids = rows.map((row) => row.uid);
    if (!uids.length) return;
    await this.stepModel.destroy({ where: { workflow_uid: { [Op.in]: uids } } });
    await this.workflowModel.destroy({ where: { uid: { [Op.in]: uids } } });
  }
}
