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
  const format = (value: unknown) => value === null || value === undefined || value === '' ? t('aiChat.card.unset') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (!changes.length) return null;
  return (
    <VStack gap="8" max className={cls.root} role="list" aria-label={t('aiChat.card.configurationChanges')}>
      {changes.map(([key, value]) => (
        <VStack key={key} gap="4" max role="listitem" className={cls.row}>
          <Text variant="small">{key}</Text>
          <Text variant="muted" className={cls.value}>{format(oldValues[key])} → {format(value)}</Text>
        </VStack>
      ))}
    </VStack>
  );
}
