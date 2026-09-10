/** Snake_case tool ids must never reach the chat as a visible label. */
export function isRawToolId(value: string): boolean {
    return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(value);
}

export function resolveAgentToolLabel(
    t: (key: string, fallback?: string) => string,
    item: { labelKey: string; labelFallback: string },
): string {
    const translated = t(item.labelKey, item.labelFallback);
    if (isRawToolId(translated)) {
        return t('aiChat.progress.unknownStep', 'Выполняю шаг');
    }
    return translated;
}

export function resolveWorkflowStepLabel(
    t: (key: string, fallback?: string) => string,
    step: { tool: string; entityLabel?: string | null },
): string {
    const kind = resolveAgentToolLabel(t, {
        labelKey: `aiChat.progress.tools.${step.tool}`,
        labelFallback: step.tool,
    });
    const entity = (step.entityLabel ?? '').trim();
    if (!entity || isRawToolId(entity)) {
        return kind;
    }
    if (entity === kind || entity.includes(kind)) {
        return entity;
    }
    return `${kind}: ${entity}`;
}

export function resolveCardStatusLabel(
    t: (key: string, fallback?: string) => string,
    status: string,
): string {
    const key = `aiChat.card.badge.${status}`;
    const translated = t(key, status);
    if (translated === status || isRawToolId(translated)) {
        return t('aiChat.card.badge.pending', status);
    }
    return translated;
}
