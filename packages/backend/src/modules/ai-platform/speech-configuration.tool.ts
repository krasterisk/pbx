import { z } from 'zod';
import { NotFoundException } from '@nestjs/common';
import type { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { defineMutationTool } from './ai-mutation.contract';

/** Shared, nonsecret configuration for tenant speech providers; no paid execution. */
export function speechConfigurationTool(providers: AiProvidersService, capability: 'tts' | 'stt') {
  const schema = z.strictObject({ uid: z.number().int().positive(), name: z.string().trim().min(1).max(128).optional(), enabled: z.boolean().optional() });
  const owned = async (uid: number, tenant: number) => {
    const row = await providers.findOne(uid, tenant);
    if (!row.capabilities?.includes(capability)) throw new NotFoundException('Speech provider not found');
    return row;
  };
  return defineMutationTool({
    name: `update_${capability}_engine`, description: `Изменить имя или активность ${capability.toUpperCase()} провайдера этого кабинета. Ключи, URL, настройки и capabilities сохраняются. Платный запуск не выполняется.`,
    entityType: `${capability}_engine`, schemaVersion: 'speech-config-1', input: schema, args: schema, reload: { kind: 'none' },
    propose: async (input, ctx) => {
      if (Object.keys(input).length < 2) return { refused: true, message: 'Не указано изменение.' };
      const row = await owned(input.uid, ctx.vpbxUserUid);
      const before = { name: row.name, enabled: row.enabled };
      return { entityType: `${capability}_engine`, entityLabel: row.name, summary: [`Изменить ${capability.toUpperCase()} провайдер «${row.name}»`], before, after: { ...before, ...input }, applyPayload: { tool: `update_${capability}_engine`, args: input }, includesDialplanReload: false };
    },
    revalidate: async (args, ctx) => { await owned(args.uid, ctx.vpbxUserUid); return { ok: true, args }; },
    apply: async ({ uid, ...patch }, ctx) => { await owned(uid, ctx.vpbxUserUid); await providers.update(uid, patch, ctx.vpbxUserUid); },
  });
}
