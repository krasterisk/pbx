import { describe, expect, it } from 'vitest';
import {
    isRawToolId,
    resolveAgentToolLabel,
    resolveCardStatusLabel,
    resolveWorkflowStepLabel,
} from './agentToolLabels';

const t = (key: string, fallback?: string) => {
    const catalog: Record<string, string> = {
        'aiChat.progress.tools.list_endpoints': 'Смотрю абонентов',
        'aiChat.progress.tools.create_ivr': 'Готовлю голосовое меню',
        'aiChat.progress.tools.create_call_group': 'Готовлю группу вызова',
        'aiChat.progress.unknownStep': 'Выполняю шаг',
        'aiChat.card.badge.pending': 'Нужно подтверждение',
        'aiChat.card.badge.failed': 'Ошибка',
    };
    return catalog[key] ?? fallback ?? key;
};

describe('agentToolLabels', () => {
    it('treats snake_case tool ids as raw', () => {
        expect(isRawToolId('list_tts_engines')).toBe(true);
        expect(isRawToolId('propose_plan')).toBe(true);
        expect(isRawToolId('Смотрю абонентов')).toBe(false);
        expect(isRawToolId('aiChat.progress.tools.list_queues')).toBe(false);
    });

    it('never returns a raw tool id as the step label', () => {
        expect(resolveAgentToolLabel(t, {
            labelKey: 'aiChat.progress.tools.list_endpoints',
            labelFallback: 'list_endpoints',
        })).toBe('Смотрю абонентов');
        expect(resolveAgentToolLabel(t, {
            labelKey: 'aiChat.progress.tools.list_tts_engines',
            labelFallback: 'list_tts_engines',
        })).toBe('Выполняю шаг');
    });

    it('prefers a human entity label over the tool id on a plan step', () => {
        expect(resolveWorkflowStepLabel(t, { tool: 'create_ivr', entityLabel: 'Рога и копыта' }))
            .toBe('Готовлю голосовое меню: Рога и копыта');
        expect(resolveWorkflowStepLabel(t, { tool: 'create_call_group', entityLabel: 'Рога и копыта' }))
            .toBe('Готовлю группу вызова: Рога и копыта');
        expect(resolveWorkflowStepLabel(t, { tool: 'propose_plan', entityLabel: 'propose_plan' }))
            .toBe('Выполняю шаг');
    });

    it('translates card statuses instead of showing pending/failed', () => {
        expect(resolveCardStatusLabel(t, 'pending')).toBe('Нужно подтверждение');
        expect(resolveCardStatusLabel(t, 'failed')).toBe('Ошибка');
        expect(resolveCardStatusLabel(t, 'unknown_status')).toBe('Нужно подтверждение');
    });
});
