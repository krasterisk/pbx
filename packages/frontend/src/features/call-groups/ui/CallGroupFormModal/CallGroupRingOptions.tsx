import { useTranslation } from 'react-i18next';
import { InfoTooltip, Label, Select, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { OptionsEditor } from '@/features/dialplan-apps/ui/OptionsEditor/OptionsEditor';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetMohClassesQuery } from '@/shared/api/endpoints/mohApi';
import cls from './CallGroupRingOptions.module.scss';

const DIAL_FLAGS = ['t', 'T', 'h', 'H', 'm'] as const;

export interface CallGroupRingOptionsValue {
  confirmExternal: boolean;
  skipBusy: boolean;
  greetingPrompt: string;
  mohClass: string;
  useMohInsteadOfRingback: boolean;
  dialOptions: string;
}

export interface CallGroupRingOptionsProps {
  value: CallGroupRingOptionsValue;
  onChange: (patch: Partial<CallGroupRingOptionsValue>) => void;
}

export function CallGroupRingOptions({ value, onChange }: CallGroupRingOptionsProps) {
  const { t } = useTranslation();
  const { data: prompts = [], isLoading: promptsLoading } = useGetPromptsQuery();
  const { data: mohClasses = [], isLoading: mohLoading } = useGetMohClassesQuery();

  const promptsEmpty = !promptsLoading && prompts.length === 0;
  const mohEmpty = !mohLoading && mohClasses.length === 0;
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const promptsSection = t('routes.chain.catalog.promptsSection', 'Промпты');
  const mohSection = t('callGroups.ring.mohSection', 'Музыка удержания');

  return (
    <VStack gap="12" max className={cls.root}>
      <Text variant="small" className={cls.sectionTitle}>
        {t('callGroups.ring.section', 'Настройки обзвона')}
      </Text>

      <div className={cls.field}>
        <HStack gap="8" align="center" className={cls.switchRow}>
          <Switch
            id="call-group-confirm"
            checked={value.confirmExternal}
            onCheckedChange={(checked) => onChange({ confirmExternal: checked })}
            aria-label={t('callGroups.ring.confirm', 'Подтверждение вызова')}
            title={t('callGroups.ring.confirm', 'Подтверждение вызова')}
          />
          <Label htmlFor="call-group-confirm">
            {t('callGroups.ring.confirm', 'Подтверждение вызова')}
          </Label>
          <InfoTooltip
            text={t(
              'callGroups.ring.confirmHint',
              'Внешний участник нажимает цифру, чтобы принять. Иначе голосовая почта оператора принимает вызов за человека.',
            )}
          />
        </HStack>
        <Text variant="muted" className={cls.hint}>
          {t(
            'callGroups.ring.confirmHint',
            'Внешний участник нажимает цифру, чтобы принять. Иначе голосовая почта оператора принимает вызов за человека.',
          )}
        </Text>
      </div>

      <div className={cls.field}>
        <HStack gap="8" align="center" className={cls.switchRow}>
          <Switch
            id="call-group-skip-busy"
            checked={value.skipBusy}
            onCheckedChange={(checked) => onChange({ skipBusy: checked })}
            aria-label={t('callGroups.ring.skipBusy', 'Пропускать занятых')}
            title={t('callGroups.ring.skipBusy', 'Пропускать занятых')}
          />
          <Label htmlFor="call-group-skip-busy">
            {t('callGroups.ring.skipBusy', 'Пропускать занятых')}
          </Label>
          <InfoTooltip
            text={t(
              'callGroups.ring.skipBusyHint',
              'Занятый участник не вызывается и не тратит таймаут.',
            )}
          />
        </HStack>
      </div>

      <div className={cls.field}>
        <Label htmlFor="call-group-greeting">
          {t('callGroups.ring.greeting', 'Приветствие абоненту')}
        </Label>
        <Select
          id="call-group-greeting"
          className={cls.touch}
          disabled={promptsLoading || promptsEmpty}
          value={value.greetingPrompt}
          onChange={(e) => onChange({ greetingPrompt: e.target.value })}
        >
          <option value="">
            {promptsLoading ? loadingLabel : promptsEmpty ? emptyLabel : t('routes.chain.catalog.choose', 'Выберите')}
          </option>
          {prompts.map((p) => (
            <option key={p.uid} value={p.filename}>
              {p.comment || p.filename}
            </option>
          ))}
        </Select>
        {promptsEmpty ? (
          <>
            <Text variant="muted">
              {t('routes.chain.catalog.emptyHint', 'Сначала создайте запись в разделе «{{section}}»').replace(
                '{{section}}',
                promptsSection,
              )}
            </Text>
            <a href="/prompts" target="_blank" rel="noopener noreferrer" className={cls.catalogLink}>
              {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
                '{{section}}',
                promptsSection,
              )}
            </a>
          </>
        ) : null}
      </div>

      <div className={cls.field}>
        <HStack gap="8" align="center" className={cls.switchRow}>
          <Switch
            id="call-group-moh"
            checked={value.useMohInsteadOfRingback}
            onCheckedChange={(checked) => onChange({ useMohInsteadOfRingback: checked })}
            aria-label={t('callGroups.ring.moh', 'Музыка вместо гудков')}
            title={t('callGroups.ring.moh', 'Музыка вместо гудков')}
          />
          <Label htmlFor="call-group-moh">{t('callGroups.ring.moh', 'Музыка вместо гудков')}</Label>
        </HStack>
        <Label htmlFor="call-group-moh-class">
          {t('callGroups.ring.mohClass', 'Класс музыки удержания')}
        </Label>
        <Select
          id="call-group-moh-class"
          className={cls.touch}
          disabled={!value.useMohInsteadOfRingback || mohLoading || mohEmpty}
          value={value.mohClass}
          onChange={(e) => onChange({ mohClass: e.target.value })}
        >
          <option value="">
            {mohLoading ? loadingLabel : mohEmpty ? emptyLabel : t('routes.chain.catalog.choose', 'Выберите')}
          </option>
          {mohClasses.map((m) => (
            <option key={m.name} value={m.name}>
              {m.displayName || m.name}
            </option>
          ))}
        </Select>
        {mohEmpty ? (
          <a href="/moh" target="_blank" rel="noopener noreferrer" className={cls.catalogLink}>
            {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
              '{{section}}',
              mohSection,
            )}
          </a>
        ) : null}
      </div>

      <div className={cls.field}>
        <Label htmlFor="call-group-dial-options">
          {t('callGroups.ring.dialOptions', 'Опции Dial')}
        </Label>
        <OptionsEditor
          value={value.dialOptions}
          flags={DIAL_FLAGS}
          onChange={(next) => onChange({ dialOptions: next })}
        />
      </div>
    </VStack>
  );
}
