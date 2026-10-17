import { createHash } from 'crypto';
import { z } from 'zod';
import { defineMutationTool, parseMutationInput, type AiMutationContext } from '../ai-platform/ai-mutation.contract';
import { assertSupervisor } from './callcenter-rbac.util';

/** Deterministic revision including nested JSON and Sequelize values. */
export function configRevision(value: unknown): string {
  const plain = JSON.parse(JSON.stringify(value)) as unknown;
  const sort = (v: any): any => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, sort(v[key])])) : v;
  return createHash('sha256').update(JSON.stringify(sort(plain))).digest('hex');
}

export function requireCcSupervisor(ctx: { role?: number; userUid?: number } | undefined): void {
  if (!Number.isInteger(ctx?.role)) throw new Error('Authenticated role required');
  assertSupervisor({ level: ctx?.role });
  if (!Number.isInteger(ctx?.userUid) || ctx!.userUid! <= 0) throw new Error('Authenticated user required');
}

/** Every configuration write goes through the shared proposal/confirm contract. */
export function ccConfigMutation(spec: {
  name: string; description: string; schema: z.ZodObject<any>; destructive?: boolean;
  authorize?: (input: any, ctx: AiMutationContext) => void;
  read: (input: any, ctx: AiMutationContext) => Promise<any>;
  write: (input: any, ctx: AiMutationContext) => Promise<any>;
  preview?: (input: any, before: any) => any;
}) {
  const authorize = spec.authorize ?? ((_input, ctx) => requireCcSupervisor(ctx));
  const canonical = z.strictObject({ input: spec.schema, revision: z.string() });
  const revalidate = async (args: z.infer<typeof canonical>, ctx: AiMutationContext) => {
    authorize(args.input, ctx);
    const before = await spec.read(args.input, ctx);
    return configRevision(before) === args.revision
      ? { ok: true as const, args }
      : { ok: false as const, reason: 'Настройки изменились после предпросмотра. Прочитайте текущее состояние и создайте новое предложение.' };
  };
  const tool = defineMutationTool({
    name: spec.name, description: spec.description, entityType: 'callcenter_config',
    schemaVersion: 'cc-config-1', input: spec.schema, args: canonical,
    destructive: spec.destructive, reload: { kind: 'none' },
    propose: async (input, ctx) => {
      authorize(input, ctx);
      const before = await spec.read(input, ctx);
      return {
        entityType: 'callcenter_config', entityLabel: spec.description,
        summary: [spec.description, 'Применение после подтверждения; настройки действуют на текущий КЦ.'],
        before: before == null ? null : { configuration: before },
        after: { configuration: spec.preview ? spec.preview(input, before) : input },
        applyPayload: { tool: spec.name, args: { input, revision: configRevision(before) } },
        includesDialplanReload: false,
      };
    },
    revalidate,
    apply: async (args, ctx) => {
      const check = await revalidate(args, ctx);
      if (!check.ok) throw new Error(check.reason);
      await spec.write(args.input, ctx);
      return { success: true };
    },
  });
  tool.handler = async (raw, tenant, caller) => {
    if (!caller) throw new Error('Authenticated user required');
    return tool.mutation!.propose(parseMutationInput(tool.mutation!, raw), {
      vpbxUserUid: tenant, userUid: caller.userUid, role: caller.role, isAdmin: [0, 1].includes(caller.role),
    });
  };
  return tool;
}
