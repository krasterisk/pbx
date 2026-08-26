import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetCallGroupsQuery } from '@/shared/api/endpoints/callGroupApi';
import { OptionsEditor } from '../OptionsEditor/OptionsEditor';
import { inferOptionFlags } from '../../model/inferOptionFlags';
import styles from './CallGroupDialOptionsPanel.module.scss';

const DIAL_FLAGS = ['t', 'T', 'h', 'H'] as const;

export interface CallGroupDialOptionsPanelProps {
  groupUid: string;
}

export function CallGroupDialOptionsPanel({ groupUid }: CallGroupDialOptionsPanelProps) {
  const { t } = useTranslation();
  const groupsQuery = useGetCallGroupsQuery();
  const uid = Number(groupUid);

  const group = useMemo(() => {
    if (!Number.isInteger(uid) || uid <= 0) return undefined;
    return (groupsQuery.data ?? []).find((item) => item.uid === uid);
  }, [groupsQuery.data, uid]);

  const dialOptions = group?.dialOptions?.trim() || 'tT';
  const flags = inferOptionFlags(dialOptions, DIAL_FLAGS);

  if (!groupUid.trim()) {
    return (
      <Text variant="muted">
        {t('routes.chain.togroup.optionsPickGroup', 'Сначала выберите группу вызова — здесь появятся её опции Dial.')}
      </Text>
    );
  }

  if (groupsQuery.isLoading) {
    return <Text variant="muted">{t('routes.chain.catalog.loading', 'Загружаем список')}</Text>;
  }

  if (!group) {
    return (
      <Text variant="muted">
        {t('routes.chain.togroup.optionsGroupMissing', 'Группа не найдена. Выберите другую или создайте группу в разделе «Группы вызова».')}
      </Text>
    );
  }

  return (
    <VStack gap="12" max>
      <HStack gap="4" align="center">
        <Text variant="muted">
          {t(
            'routes.chain.togroup.optionsExplainPlain',
            'Набор участников идёт через Dial внутри группы. Перевод и сброс кодами функций настраиваются в карточке группы, не в этом шаге.',
          )}
        </Text>
        <InfoTooltip
          text={t(
            'routes.chain.togroup.optionsTooltip',
            'Флаги **t/T/h/H** задаются в настройках группы вызова (раздел «Группы вызова» → опции Dial).\nШаг маршрута только направляет вызов в группу.',
          )}
        />
      </HStack>
      <OptionsEditor value={dialOptions} flags={flags} onChange={() => undefined} readOnly embedded />
      <a
        href={`/call-groups?edit=${group.uid}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.editLink}
      >
        <ExternalLink size={14} aria-hidden />
        {t('routes.chain.togroup.optionsEditLink', 'Изменить опции в группе «{{name}}»').replace(
          '{{name}}',
          group.name,
        )}
      </a>
    </VStack>
  );
}
