import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip, Label, Select, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { OptionsEditor } from '@/features/dialplan-apps/ui/OptionsEditor/OptionsEditor';
import { toggleFlag } from '@/features/dialplan-apps/model/optionsSync';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetMohClassesQuery } from '@/shared/api/endpoints/mohApi';
import cls from './CallGroupRingOptions.module.scss';

/** `m` / `m(class)` are owned by useMohInsteadOfRingback — not listed as Dial checkboxes. */
const DIAL_FLAGS = ['t', 'T', 'h', 'H'] as const;

const CONFIRM_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'] as const;

const CONFIRM_HINT =
  'Только для внешних номеров (мобильных, городских).\n\n' +
  'После ответа абонент слышит сигнал и должен нажать выбранную цифру, чтобы принять звонок.\n\n' +
  'Зачем: автоответчик или голосовая почта могут ответить вместо человека — ' +
  'без подтверждения группа решит, что вызов принят, и перестанет звонить остальным.';

/** Strip bare `m` / `m(...)` so MOH is not duplicated in dialplan. */
export function stripMohDialOption(input: string): string {
  return toggleFlag(input, 'm', false);
}

export interface CallGroupRingOptionsValue {
  confirmExternal: boolean;
  confirmDigit: string;
  skipBusy: boolean;
  useGreeting: boolean;
  greetingPrompt: string;
  mohClass: string;
  useMohInsteadOfRingback: boolean;
  dialOptions: string;
}

export interface CallGroupRingOptionsProps {
  value: CallGroupRingOptionsValue;
  onChange: (patch: Partial<CallGroupRingOptionsValue>) => void;
  /** Confirm applies only to external members — hide the control otherwise. */
  hasExternalMembers?: boolean;
}

export function CallGroupRingOptions({
  value,
  onChange,
  hasExternalMembers = false,
}: CallGroupRingOptionsProps) {
  const { t } = useTranslation();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [dialOptionsOpen, setDialOptionsOpen] = useState(false);
  const { data: prompts = [], isLoading: promptsLoading } = useGetPromptsQuery();
  const { data: mohClasses = [], isLoading: mohLoading } = useGetMohClassesQuery();

  const promptsEmpty = !promptsLoading && prompts.length === 0;
  const mohEmpty = !mohLoading && mohClasses.length === 0;
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const promptsSection = t('routes.chain.catalog.promptsSection', 'Промпты');
  const mohSection = t('callGroups.ring.mohSection', 'Музыка удержания');

  return (
    <div className={`${cls.root} ${cls.collapsible}`}>
      <button
        type="button"
        className={cls.groupToggle}
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((v) => !v)}
      >
        {sectionOpen ? (
          <ChevronDown className={cls.groupToggleIcon} size={16} aria-hidden />
        ) : (
          <ChevronRight className={cls.groupToggleIcon} size={16} aria-hidden />
        )}
        <span className={cls.groupToggleLabel}>
          {t('callGroups.ring.section', 'Настройки обзвона')}
        </span>
        <span className={cls.groupToggleHint}>
          {sectionOpen
            ? t('routes.chain.section.collapse', 'Свернуть')
            : t('routes.chain.section.expand', 'Раскрыть')}
        </span>
      </button>

      {sectionOpen ? (
        <VStack gap="12" max className={cls.sectionBody}>
          {hasExternalMembers ? (
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
                <InfoTooltip text={t('callGroups.ring.confirmHint', CONFIRM_HINT)} />
              </HStack>
              {value.confirmExternal ? (
                <div className={cls.confirmDigitRow}>
                  <Label htmlFor="call-group-confirm-digit">
                    {t('callGroups.ring.confirmDigit', 'Цифра подтверждения')}
                  </Label>
                  <Select
                    id="call-group-confirm-digit"
                    className={cls.confirmDigitSelect}
                    value={value.confirmDigit || '1'}
                    onChange={(e) => onChange({ confirmDigit: e.target.value })}
                    aria-label={t('callGroups.ring.confirmDigit', 'Цифра подтверждения')}
                  >
                    {CONFIRM_DIGITS.map((digit) => (
                      <option key={digit} value={digit}>
                        {digit}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

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
            <HStack gap="8" align="center" className={cls.switchRow}>
              <Switch
                id="call-group-greeting-enabled"
                checked={value.useGreeting}
                onCheckedChange={(checked) =>
                  onChange({
                    useGreeting: checked,
                    ...(checked ? {} : { greetingPrompt: '' }),
                  })
                }
                aria-label={t('callGroups.ring.greeting', 'Приветствие абоненту')}
                title={t('callGroups.ring.greeting', 'Приветствие абоненту')}
              />
              <Label htmlFor="call-group-greeting-enabled">
                {t('callGroups.ring.greeting', 'Приветствие абоненту')}
              </Label>
              <InfoTooltip
                text={t(
                  'callGroups.ring.greetingHint',
                  'Перед обзвоном группы абоненту проигрывается выбранная запись.',
                )}
              />
            </HStack>
            {value.useGreeting ? (
              <>
                <Label htmlFor="call-group-greeting">
                  {t('callGroups.ring.greetingPrompt', 'Запись приветствия')}
                </Label>
                <Select
                  id="call-group-greeting"
                  className={cls.touch}
                  disabled={promptsLoading || promptsEmpty}
                  value={value.greetingPrompt}
                  onChange={(e) => onChange({ greetingPrompt: e.target.value })}
                >
                  <option value="">
                    {promptsLoading
                      ? loadingLabel
                      : promptsEmpty
                        ? emptyLabel
                        : t('routes.chain.catalog.choose', 'Выберите')}
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
                      {t(
                        'routes.chain.catalog.emptyHint',
                        'Сначала создайте запись в разделе «{{section}}»',
                      ).replace('{{section}}', promptsSection)}
                    </Text>
                    <a href="/prompts" target="_blank" rel="noopener noreferrer" className={cls.catalogLink}>
                      {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
                        '{{section}}',
                        promptsSection,
                      )}
                    </a>
                  </>
                ) : null}
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
              <InfoTooltip
                text={t(
                  'callGroups.ring.mohHint',
                  'Включает Dial-опцию m / m(класс). Не дублируйте флаг m в строке опций ниже.',
                )}
              />
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
                {mohLoading
                  ? loadingLabel
                  : mohEmpty
                    ? emptyLabel
                    : t('routes.chain.catalog.choose', 'Выберите')}
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

          <div className={cls.nestedCollapsible}>
            <button
              type="button"
              className={cls.groupToggle}
              aria-expanded={dialOptionsOpen}
              onClick={() => setDialOptionsOpen((v) => !v)}
            >
              {dialOptionsOpen ? (
                <ChevronDown className={cls.groupToggleIcon} size={16} aria-hidden />
              ) : (
                <ChevronRight className={cls.groupToggleIcon} size={16} aria-hidden />
              )}
              <span className={cls.groupToggleLabel}>
                {t('callGroups.ring.dialOptions', 'Опции Dial')}
              </span>
              <span className={cls.groupToggleHint}>
                {dialOptionsOpen
                  ? t('routes.chain.section.collapse', 'Свернуть')
                  : t('routes.chain.section.expand', 'Раскрыть')}
              </span>
            </button>
            {dialOptionsOpen ? (
              <OptionsEditor
                value={stripMohDialOption(value.dialOptions)}
                flags={DIAL_FLAGS}
                onChange={(next) => onChange({ dialOptions: stripMohDialOption(next) })}
              />
            ) : null}
          </div>
        </VStack>
      ) : null}
    </div>
  );
}
