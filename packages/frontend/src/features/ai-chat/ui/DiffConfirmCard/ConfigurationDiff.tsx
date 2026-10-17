import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import cls from './ConfigurationDiff.module.scss';

const HIDDEN = /password|secret|token|authorization|api[_-]?key|credential|private[_-]?key|^requiresSecureInput$|^sipId$|^trunkId$|^uid$|^id$|^user_uid$|^tenantid$|^greeting$|^digits$|^tts$/i;
function flatten(value: Record<string, unknown> | null | undefined, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value ?? {}).flatMap(([key, child]) => {
    if (HIDDEN.test(key)) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? Object.entries(flatten(child as Record<string, unknown>, path)) : [[path, child]];
  }));
}

export function ConfigurationDiff({ before, after }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  const oldValues = flatten(before);
  const nextValues = flatten(after);
  const changes = Object.entries(nextValues).filter(([key, value]) => JSON.stringify(oldValues[key]) !== JSON.stringify(value));
  const format = (value: unknown, key: string): string => {
    if (value === null || value === undefined || value === '') return t('aiChat.card.unset');
    if (key === 'configuration.auto_open_on' && typeof value === 'string') return t(`callcenter.cards.builder.autoOpen.${value}`);
    if (key === 'scenario_actions' && Array.isArray(value)) return value.map((step: Record<string, unknown>, index) => {
      const params = (step.params ?? {}) as Record<string, unknown>;
      return `${index + 1}. ${t(`routes.action.${String(step.type)}`, String(step.type))}${params.text ? `: ${String(params.text)}` : ''}`;
    }).join('\n');
    if (key === 'schedules' && Array.isArray(value)) return value.map((window: Record<string, unknown>) =>
      `${String(window.kind)} ${window.weekday ?? ''}: ${String(window.time_from)}–${String(window.time_to)} (${window.timezone ?? ''})`).join('\n');
    if (key === 'pacing.providers' && Array.isArray(value)) return value.map((provider: Record<string, unknown>) =>
      `${t(`autodial.workspace.pacingKinds.${String(provider.type)}`, String(provider.type))}: ${provider.max_channels ?? provider.ratio ?? ''}${Array.isArray(provider.queue_names) ? ` · ${provider.queue_names.join(', ')}` : ''}`).join('\n');
    if (key === 'fields' && Array.isArray(value)) return value.map((field: Record<string, unknown>) =>
      `${field.label ?? field.key}: ${t(`autodial.bases.fieldTypeLabel.${String(field.type)}`)} · ${field.var_name ?? ''}`).join('\n');
    if (key === 'configuration.fields' && Array.isArray(value)) {
      return value.map((field: Record<string, unknown>) => {
        const parts = [String(field.label || ''), t(`callcenter.cards.fieldTypes.${String(field.field_type)}`)];
        if (field.is_required) parts.push(t('callcenter.cards.builder.required'));
        parts.push(t(field.width === 'half' ? 'callcenter.cards.builder.widthHalf' : 'callcenter.cards.builder.widthFull'));
        if (field.options && typeof field.options === 'object' && !Array.isArray(field.options) && (field.options as Record<string, unknown>).source === 'directory') parts.push(t('callcenter.cards.builder.fromDirectory'));
        else if (Array.isArray(field.options)) parts.push(field.options.map(String).join(', '));
        if (field.depends_on) parts.push(`${t('callcenter.cards.builder.advancedField')}: ${String(field.depends_on)}`);
        return parts.join(' · ');
      }).join('\n');
    }
    if (typeof value === 'boolean') return t(value ? 'common.yes' : 'common.no');
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.join(', ');
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };
  if (!changes.length) return null;
  return (
    <VStack gap="8" max className={cls.root} role="list" aria-label={t('aiChat.card.configurationChanges')}>
      {changes.map(([key, value]) => (
        <VStack key={key} gap="4" max role="listitem" className={cls.row}>
          <Text variant="small">{key.startsWith('configuration.') ? t(`aiChat.card.configFields.${key.slice(14)}`, key.slice(14).replaceAll('_', ' '))
            : /^(scenario_actions|schedules|pacing|retry|dial_mode|base_uid|success_min_sec|dial_timeout_sec)/.test(key)
              ? t(`autodial.workspace.configKeys.${key.split('.')[0]}`, key.split('.')[0]) + (key.includes('.') ? ` · ${t(`autodial.disposition.${key.split('.').at(-1)}`, key.split('.').slice(1).join(' '))}` : '') : key}</Text>
          <Text variant="muted" className={cls.value}>{format(oldValues[key], key)} → {format(value, key)}</Text>
        </VStack>
      ))}
    </VStack>
  );
}
