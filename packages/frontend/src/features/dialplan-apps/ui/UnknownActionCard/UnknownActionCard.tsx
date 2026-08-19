import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';
import type { ActionType } from '@krasterisk/shared';
import { Button, Text } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { ActionTypeSelect } from '../ActionTypeSelect';
import styles from './UnknownActionCard.module.scss';

export interface UnknownActionCardProps {
  type: string;
  params: Record<string, unknown>;
  onDelete?: () => void;
  onReplaceType?: (type: ActionType) => void;
  readOnly?: boolean;
}

function paramValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const UnknownActionCard = memo(function UnknownActionCard({
  type,
  params,
  onDelete,
  onReplaceType,
  readOnly = false,
}: UnknownActionCardProps) {
  const { t } = useTranslation();
  const entries = Object.entries(params ?? {});
  const replaceLabel = t('routes.chain.unknown.replace', 'Заменить тип');
  const deleteLabel = t('common.delete', 'Удалить');

  return (
    <VStack gap="12" className={styles.card}>
      <Flex gap="8" align="center">
        <FileQuestion size={20} />
        <Text className={styles.type}>{type}</Text>
      </Flex>
      <Text variant="muted">
        {t(
          'routes.chain.unknown.summary',
          'Неизвестный тип действия. Параметры сохранены и не будут потеряны',
        )}
      </Text>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('routes.chain.unknown.key', 'Ключ')}</th>
            <th>{t('routes.chain.unknown.value', 'Значение')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{paramValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <Flex gap="8" className={styles.actions} wrap="wrap">
          <Button type="button" variant="outline" onClick={onDelete} aria-label={deleteLabel}>
            {deleteLabel}
          </Button>
          <VStack gap="4">
            <Text variant="small">{replaceLabel}</Text>
            <ActionTypeSelect
              value=""
              onChange={(next) => {
                const ok = window.confirm(
                  t(
                    'routes.chain.unknown.replaceConfirm',
                    'Заменить неизвестное действие: сохранённые параметры будут потеряны без возможности вернуть. Продолжить?',
                  ),
                );
                if (ok) onReplaceType?.(next);
              }}
            />
            <Button type="button" variant="ghost" aria-label={replaceLabel} disabled>
              {replaceLabel}
            </Button>
          </VStack>
        </Flex>
      ) : null}
    </VStack>
  );
});
