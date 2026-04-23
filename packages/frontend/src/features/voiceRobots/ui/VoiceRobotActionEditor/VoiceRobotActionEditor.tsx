import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, ArrowRight, SlidersHorizontal, Plus, Trash2, Globe,
  Headphones, GitBranch, PhoneForwarded, PhoneOff, Database,
} from 'lucide-react';
import { VStack, HStack, Input, Select, Label, Button, Text, Textarea, RadioCards } from '@/shared/ui';
import { InfoTooltip, Tooltip } from '@/shared/ui/Tooltip/Tooltip';
import {
  IVoiceRobotBotAction,
  IBotResponse,
  IBotNextState,
  ISlotDefinition,
  IDataListSearchConfig,
  RESPONSE_TYPE_OPTIONS,
  SLOT_TYPE_OPTIONS,
  BotResponseType,
  BotNextStateType,
  SlotType,
} from '@/entities/voiceRobot';
import { useGetVoiceRobotKeywordGroupsQuery } from '@/shared/api/endpoints/voiceRobotsApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { WebhookAuthConfig, AuthMode } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';
import { useGetVoiceRobotDataListsQuery } from '@/shared/api/endpoints/voiceRobotDataListsApi';
import { SlotChoiceEditor } from '../SlotChoiceEditor/SlotChoiceEditor';
import cls from './VoiceRobotActionEditor.module.scss';

interface VoiceRobotActionEditorProps {
  action: IVoiceRobotBotAction;
  onChange: (action: IVoiceRobotBotAction) => void;
  robotId?: number;
  /** When true, hides slots and webhook details — used for fallback/max-retries editors */
  compact?: boolean;
}

/**
 * VoiceRobotActionEditor — specialized editor for a keyword's bot action.
 *
 * Structured form with RadioCards for nextState selection:
 * 1. Response section (TTS text / audio prompt / none)
 * 2. Next State (RadioCards with icons and descriptions)
 * 3. Webhook settings (URL, auth, response template)
 * 4. Slot definitions (data collection before executing next state)
 *
 * FSD layer: features/voiceRobots/ui
 */
export const VoiceRobotActionEditor = memo(({ action, onChange, robotId, compact }: VoiceRobotActionEditorProps) => {
  const { t } = useTranslation();

  const { data: groups = [] } = useGetVoiceRobotKeywordGroupsQuery(robotId ?? 0, { skip: !robotId });
  const { data: queues = [] } = useGetQueuesQuery();
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: prompts = [] } = useGetPromptsQuery();
  const { data: dataLists = [] } = useGetVoiceRobotDataListsQuery(robotId ?? 0, { skip: !robotId });

  const [tExt = '', tCtx = ''] = String(action.nextState.target || '').split('@');

  // ─── RadioCards options for nextState ─────────────────
  const nextStateOptions = useMemo(() => [
    {
      value: 'listen',
      label: t('voiceRobots.action.listen', 'Продолжить слушать'),
      description: t('voiceRobots.nextStateDescriptions.listen', 'Робот ждёт следующую фразу клиента'),
      icon: Headphones,
    },
    {
      value: 'switch_group',
      label: t('voiceRobots.action.switchGroup', 'Переключить сценарий'),
      description: t('voiceRobots.nextStateDescriptions.switch_group', 'Робот перейдёт к другому набору сценариев'),
      icon: GitBranch,
    },
    {
      value: 'transfer_exten',
      label: t('voiceRobots.action.transferExten', 'Перевод на номер или очередь'),
      description: t('voiceRobots.nextStateDescriptions.transfer_exten', 'Звонок переведётся на указанный номер (или очередь)'),
      icon: PhoneForwarded,
    },
    {
      value: 'webhook',
      label: t('voiceRobots.action.webhook', 'Webhook запрос'),
      description: t('voiceRobots.nextStateDescriptions.webhook', 'Робот соберёт данные и отправит на сервер'),
      icon: Globe,
    },
    {
      value: 'hangup',
      label: t('voiceRobots.action.hangup', 'Завершить звонок'),
      description: t('voiceRobots.nextStateDescriptions.hangup', 'Звонок будет завершён'),
      icon: PhoneOff,
    },
    {
      value: 'search_data_list',
      label: t('voiceRobots.action.searchDataList', 'Поиск по справочнику'),
      description: t('voiceRobots.nextStateDescriptions.search_data_list', 'Робот найдёт информацию в справочнике данных'),
      icon: Database,
    },
  ], [t]);

  // ─── Response handlers ───────────────────────────────
  const updateResponse = useCallback((partial: Partial<IBotResponse>) => {
    onChange({ ...action, response: { ...action.response, ...partial } });
  }, [action, onChange]);

  // ─── Next State handlers ─────────────────────────────
  const updateNextState = useCallback((partial: Partial<IBotNextState>) => {
    onChange({ ...action, nextState: { ...action.nextState, ...partial } });
  }, [action, onChange]);

  // ─── Slot handlers ──────────────────────────────────
  const addSlot = useCallback(() => {
    const newSlot: ISlotDefinition = {
      name: `slot_${(action.slots?.length || 0) + 1}`,
      type: 'digits',
      prompt: { type: 'tts', value: '' },
      maxRetries: 3,
    };
    onChange({ ...action, slots: [...(action.slots || []), newSlot] });
  }, [action, onChange]);

  const removeSlot = useCallback((index: number) => {
    const slots = [...(action.slots || [])];
    slots.splice(index, 1);
    onChange({ ...action, slots });
  }, [action, onChange]);

  const updateSlot = useCallback((index: number, partial: Partial<ISlotDefinition>) => {
    const slots = [...(action.slots || [])];
    slots[index] = { ...slots[index], ...partial };
    onChange({ ...action, slots });
  }, [action, onChange]);

  const showWebhook = action.nextState.type === 'webhook';
  const showDataListSearch = action.nextState.type === 'search_data_list';

  // ─── Data List Search helpers ────────────────────────
  const dlsConfig = action.dataListSearch || {
    listId: 0,
    querySource: 'last_utterance' as const,
    returnField: '',
    resultVariable: '',
  };

  const updateDataListSearch = useCallback((partial: Partial<IDataListSearchConfig>) => {
    onChange({
      ...action,
      dataListSearch: { ...dlsConfig, ...partial },
    });
  }, [action, onChange, dlsConfig]);

  // Get columns for the selected data list
  const selectedList = dataLists.find(dl => dl.uid === dlsConfig.listId);
  const listColumns = selectedList?.columns || [];

  return (
    <VStack gap="16" className={cls.actionEditor}>
      {/* ═══ Section 1: Response ═══ */}
      <VStack gap="8" className={cls.section}>
        <HStack gap="4" className={cls.sectionTitle}>
          <MessageSquare className={cls.sectionIcon} />
          <Text className="font-bold text-foreground">{t('voiceRobots.action.step1Prefix', 'ШАГ 1. ')} {t('voiceRobots.action.responseTitle', 'Ответ робота')}</Text>
        </HStack>

        <HStack gap="8">
          <VStack gap="4" className="flex-1">
            <Label>{t('voiceRobots.action.responseType', 'Тип ответа')}</Label>
            <Select
              value={action.response.type}
              onChange={e => updateResponse({ type: e.target.value as BotResponseType })}
            >
              {RESPONSE_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </Select>
          </VStack>

          {action.response.type === 'tts' && (
            <VStack gap="4" className="flex-[2]">
              <Label>{t('voiceRobots.action.ttsText', 'Текст для синтеза')}</Label>
              <Textarea
                value={action.response.value || ''}
                onChange={e => updateResponse({ value: e.target.value })}
                placeholder={t('voiceRobots.action.ttsPlaceholder', 'Назовите вашего менеджера или район обслуживания')}
                rows={2}
              />
            </VStack>
          )}

          {action.response.type === 'prompt' && (
            <VStack gap="4" className="flex-[2]">
              <Label>{t('voiceRobots.action.prompt', 'Промпт')}</Label>
              <Select
                value={action.response.value || ''}
                onChange={e => updateResponse({ value: e.target.value })}
              >
                <option value="">{t('voiceRobots.action.selectPrompt', '— Выберите промпт —')}</option>
                {prompts.map(p => (
                  <option key={p.uid} value={p.filename}>
                    {p.comment ? `${p.comment} (${p.filename})` : p.filename}
                  </option>
                ))}
              </Select>
            </VStack>
          )}
        </HStack>
      </VStack>

      {/* ═══ Section 3: Slots (hidden in compact mode) ═══ */}
      {!compact && (
        <VStack gap="8" className={cls.section}>
          <HStack gap="4" className={cls.sectionTitle}>
            <SlidersHorizontal className={cls.sectionIcon} />
            <Text className="font-bold text-foreground">{t('voiceRobots.action.step2Prefix', 'ШАГ 2. ')} {t('voiceRobots.action.slotsTitle', 'Сбор данных')} <span className="font-normal text-muted-foreground ml-1">{t('voiceRobots.action.optional', '(опционально)')}</span></Text>
            <InfoTooltip text={t('voiceRobots.action.slotsHint', 'Параметры, которые робот соберёт у клиента перед выполнением действия. Все собранные данные передаются в webhook.')} />
          </HStack>

          {(action.slots || []).map((slot, idx) => (
            <VStack key={idx} gap="8" className={cls.slotCard}>
              <HStack className={cls.slotHeader}>
                <Text className={cls.slotIndex}>
                  {t('voiceRobots.action.slotN', 'Параметр')} #{idx + 1}
                </Text>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cls.removeSlotBtn}
                  onClick={() => removeSlot(idx)}
                >
                  <Trash2 size={14} />
                </Button>
              </HStack>

              <HStack gap="8">
                <VStack gap="4" className="flex-[2]">
                  <Label>{t('voiceRobots.action.slotName', 'Имя переменной')}</Label>
                  <Input
                    value={slot.name}
                    onChange={e => updateSlot(idx, { name: e.target.value })}
                    placeholder="account_number"
                  />
                </VStack>
                <VStack gap="4" className="flex-[2]">
                  <Label>{t('voiceRobots.action.slotType', 'Тип данных')}</Label>
                  <Select
                    value={slot.type}
                    onChange={e => updateSlot(idx, { type: e.target.value as SlotType })}
                  >
                    {SLOT_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey, opt.fallback)}
                      </option>
                    ))}
                  </Select>
                </VStack>
                <VStack gap="4" className="flex-1 min-w-[80px]">
                  <Label>{t('voiceRobots.action.slotRetries', 'Попыток')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={slot.maxRetries ?? 3}
                    onChange={e => updateSlot(idx, { maxRetries: parseInt(e.target.value, 10) || 3 })}
                  />
                </VStack>
              </HStack>

              <VStack gap="4">
                <Label>{t('voiceRobots.action.slotPrompt', 'Вопрос для сбора')}</Label>
                <Textarea
                  value={slot.prompt.value || ''}
                  onChange={e => updateSlot(idx, {
                    prompt: { ...slot.prompt, type: 'tts', value: e.target.value },
                  })}
                  placeholder={t('voiceRobots.action.slotPromptPlaceholder', 'Назовите ваш номер счёта')}
                  rows={2}
                />
              </VStack>

              {/* Choice editor — shown when slot type is 'choice' */}
              {slot.type === 'choice' && (
                <SlotChoiceEditor
                  choices={slot.choices || []}
                  onChange={(choices) => updateSlot(idx, { choices })}
                />
              )}
            </VStack>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addSlot}
            className={cls.addSlotBtn}
          >
            <Plus size={14} />
            <Text>{t('voiceRobots.action.addSlot', 'Добавить параметр')}</Text>
          </Button>
        </VStack>
      )}
      {/* ═══ Section 2: Next State (RadioCards) ═══ */}
      <VStack gap="8" className={cls.section}>
        <HStack gap="4" className={cls.sectionTitle}>
          <ArrowRight className={cls.sectionIcon} />
          <Text className="font-bold text-foreground">{t('voiceRobots.action.step3Prefix', 'ШАГ 3. ')} {t('voiceRobots.action.nextStateTitle', 'Что делает робот дальше?')}</Text>
        </HStack>

        <VStack gap="4">
          <Select
            value={action.nextState.type}
            onChange={(e) => updateNextState({ type: e.target.value as BotNextStateType })}
          >
            {nextStateOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Text variant="xs" className="text-muted-foreground mt-1">
            {nextStateOptions.find(o => o.value === action.nextState.type)?.description}
          </Text>
        </VStack>

        {/* Target selectors based on nextState type */}
        {action.nextState.type === 'switch_group' && robotId && (
          <VStack gap="4">
            <Label>{t('voiceRobots.action.targetGroup', 'Группа сценариев')}</Label>
            <Select
              value={String(action.nextState.target || '')}
              onChange={e => updateNextState({ target: e.target.value })}
            >
              <option value="">{t('voiceRobots.action.selectGroup', '— Выберите группу —')}</option>
              {groups.map(g => (
                <option key={g.uid} value={g.uid}>{g.name}</option>
              ))}
            </Select>
          </VStack>
        )}

        {action.nextState.type === 'transfer_exten' && (
          <HStack gap="8">
            <VStack gap="4" className="flex-1">
              <Label>{t('voiceRobots.action.targetExtenExt', 'Экстеншен')}</Label>
              <Input
                value={tExt}
                onChange={e => updateNextState({ target: `${e.target.value}@${tCtx}` })}
                placeholder="100"
              />
            </VStack>
            <VStack gap="4" className="flex-1">
              <Label>
                {t('voiceRobots.action.targetExtenCtx', 'Контекст')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Select
                value={tCtx}
                onChange={e => updateNextState({ target: `${tExt}@${e.target.value}` })}
                className={!tCtx ? 'border-destructive ring-destructive/20' : ''}
              >
                <option value="">{t('voiceRobots.action.selectContext', '— Выберите контекст —')}</option>
                {contexts.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </Select>
              {!tCtx && (
                <Text variant="xs" className="text-destructive">
                  {t('voiceRobots.action.contextRequired', 'Контекст обязателен для перевода')}
                </Text>
              )}
            </VStack>
          </HStack>
        )}
      </VStack>

      {/* ═══ Section 3.5: Data List Search Config ═══ */}
      {showDataListSearch && robotId && (
        <VStack gap="8" className={cls.section}>
          <HStack gap="4" className={cls.sectionTitle}>
            <Database className={cls.sectionIcon} />
            <Text className="font-bold text-foreground">{t('voiceRobots.action.dataListTitle', 'Настройки поиска по справочнику')}</Text>
          </HStack>

          <HStack gap="8">
            <VStack gap="4" className="flex-[2]">
              <Label>{t('voiceRobots.action.dataListSelect', 'Справочник')}</Label>
              <Select
                value={String(dlsConfig.listId || '')}
                onChange={e => updateDataListSearch({ listId: parseInt(e.target.value, 10) || 0 })}
              >
                <option value="">{t('voiceRobots.action.selectDataList', '— Выберите справочник —')}</option>
                {dataLists.map(dl => (
                  <option key={dl.uid} value={dl.uid}>
                    {dl.name} ({dl.rows?.length || 0} {t('voiceRobots.action.dataListRecords', 'записей')})
                  </option>
                ))}
              </Select>
            </VStack>
            <VStack gap="4" className="flex-1">
              <Label>{t('voiceRobots.action.querySource', 'Источник запроса')}</Label>
              <Select
                value={dlsConfig.querySource}
                onChange={e => updateDataListSearch({ querySource: e.target.value as 'last_utterance' | 'slot' })}
              >
                <option value="last_utterance">{t('voiceRobots.action.queryLastUtterance', 'Последняя фраза')}</option>
                <option value="slot">{t('voiceRobots.action.querySlot', 'Из параметра (слота)')}</option>
              </Select>
            </VStack>
          </HStack>

          {dlsConfig.querySource === 'slot' && (
            <VStack gap="4">
              <Label>{t('voiceRobots.action.querySlotName', 'Имя слота')}</Label>
              <Input
                value={dlsConfig.querySlotName || ''}
                onChange={e => updateDataListSearch({ querySlotName: e.target.value })}
                placeholder="full_name"
              />
            </VStack>
          )}

          <HStack gap="8">
            <VStack gap="4" className="flex-1">
              <Label>{t('voiceRobots.action.returnField', 'Возвращаемое поле')}</Label>
              {listColumns.length > 0 ? (
                <Select
                  value={dlsConfig.returnField}
                  onChange={e => updateDataListSearch({ returnField: e.target.value })}
                >
                  <option value="">{t('voiceRobots.action.selectField', '— Выберите поле —')}</option>
                  {listColumns.map(col => (
                    <option key={col.key} value={col.key}>{col.label} ({col.key})</option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={dlsConfig.returnField}
                  onChange={e => updateDataListSearch({ returnField: e.target.value })}
                  placeholder="phone"
                />
              )}
            </VStack>
            <VStack gap="4" className="flex-1">
              <HStack align="center" gap="4">
                <Label>{t('voiceRobots.action.resultVariable', 'Префикс переменных строки')}</Label>
                <InfoTooltip text={t('voiceRobots.action.resultVariableHint',
                  'Задаёт имя-префикс для всех полей найденной строки.\n\nПример: префикс «manager» → {{manager}} (значение поля «Возврат»), {{manager_фио}}, {{manager_район}}, {{manager_телефон}} и т.д.\n\nЕсли оставить «result» → {{result}}, {{result_фио}} и т.д.'
                )} />
              </HStack>
              <Input
                value={dlsConfig.resultVariable}
                onChange={e => updateDataListSearch({ resultVariable: e.target.value })}
                placeholder="result"
              />
            </VStack>
          </HStack>

          <HStack gap="8">
            <VStack gap="4" className="flex-1">
              <Label>{t('voiceRobots.action.multiMatchStrategy', 'При нескольких совпадениях')}</Label>
              <Select
                value={dlsConfig.multiMatchStrategy || 'best'}
                onChange={e => updateDataListSearch({
                  multiMatchStrategy: e.target.value as 'best' | 'random',
                })}
              >
                <option value="best">{t('voiceRobots.action.strategyBest', 'Первое совпадение')}</option>
                <option value="random">{t('voiceRobots.action.strategyRandom', 'Случайный выбор')}</option>
              </Select>
              <Text variant="xs" className="text-muted-foreground">
                {dlsConfig.multiMatchStrategy === 'random'
                  ? t('voiceRobots.action.strategyRandomHint', 'Робот случайно выберет одну из подходящих строк — для распределения нагрузки')
                  : t('voiceRobots.action.strategyBestHint', 'Робот вернёт первую подходящую строку из справочника')
                }
              </Text>
            </VStack>
          </HStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.action.notFoundText', 'Ответ если не найдено (TTS)')}</Label>
            <Textarea
              value={dlsConfig.notFoundResponse?.value || ''}
              onChange={e => updateDataListSearch({
                notFoundResponse: { type: 'tts', value: e.target.value },
              })}
              placeholder={t('voiceRobots.action.notFoundPlaceholder', 'Информация не найдена. Попробуйте ещё раз.')}
              rows={2}
            />
          </VStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.action.notFoundAction', 'Действие если не найдено')}</Label>
            <HStack gap="8">
              <VStack gap="4" className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  {t('voiceRobots.action.notFoundRetries', 'Кол-во попыток до действия')}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={dlsConfig.maxNotFoundRetries ?? 1}
                  onChange={e => updateDataListSearch({
                    maxNotFoundRetries: parseInt(e.target.value, 10) || 1,
                  })}
                />
              </VStack>
              <VStack gap="4" className="flex-[2]">
                <Label className="text-xs text-muted-foreground">
                  {t('voiceRobots.action.notFoundNextStateType', 'Действие')}
                </Label>
                <Select
                  value={dlsConfig.notFoundNextState?.type || 'transfer_exten'}
                  onChange={e => updateDataListSearch({
                    notFoundNextState: {
                      type: e.target.value as BotNextStateType,
                      target: dlsConfig.notFoundNextState?.target || '',
                    },
                  })}
                >
                  <option value="transfer_exten">{t('voiceRobots.action.transferExten', 'Перевод на номер или очередь')}</option>
                  <option value="listen">{t('voiceRobots.action.listen', 'Продолжить слушать')}</option>
                  <option value="switch_group">{t('voiceRobots.action.switchGroup', 'Переключить сценарий')}</option>
                  <option value="hangup">{t('voiceRobots.action.hangup', 'Завершить звонок')}</option>
                </Select>
              </VStack>
              {(dlsConfig.notFoundNextState?.type === 'transfer_exten' || !dlsConfig.notFoundNextState?.type) && (() => {
                const [nfExt = '', nfCtx = ''] = String(dlsConfig.notFoundNextState?.target || '').split('@');
                return (
                  <>
                    <VStack gap="4" className="flex-[2]">
                      <Label className="text-xs text-muted-foreground">
                        {t('voiceRobots.action.notFoundTarget', 'Номер/очередь')}
                      </Label>
                      <Input
                        value={nfExt}
                        onChange={e => updateDataListSearch({
                          notFoundNextState: {
                            type: dlsConfig.notFoundNextState?.type || 'transfer_exten',
                            target: `${e.target.value}@${nfCtx}`,
                          },
                        })}
                        placeholder="100"
                      />
                    </VStack>
                    <VStack gap="4" className="flex-[2]">
                      <Label className="text-xs text-muted-foreground">
                        {t('voiceRobots.action.targetExtenCtx', 'Контекст')}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Select
                        value={nfCtx}
                        onChange={e => updateDataListSearch({
                          notFoundNextState: {
                            type: dlsConfig.notFoundNextState?.type || 'transfer_exten',
                            target: `${nfExt}@${e.target.value}`,
                          },
                        })}
                        className={!nfCtx ? 'border-destructive ring-destructive/20' : ''}
                      >
                        <option value="">{t('voiceRobots.action.selectContext', '— Выберите контекст —')}</option>
                        {contexts.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </Select>
                      {!nfCtx && (
                        <Text variant="xs" className="text-destructive">
                          {t('voiceRobots.action.contextRequired', 'Контекст обязателен для перевода')}
                        </Text>
                      )}
                    </VStack>
                  </>
                );
              })()}
            </HStack>
            <Text variant="xs" className="text-muted-foreground">
              {t('voiceRobots.action.notFoundRetriesHint',
                'Робот озвучит «Ответ если не найдено» и вернётся к прослушиванию. После {{count}} неудачных попыток выполнит указанное действие.',
                { count: dlsConfig.maxNotFoundRetries ?? 1 }
              )}
            </Text>
          </VStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.action.onFoundText', 'Ответ если найдено (TTS)')}</Label>
            <Textarea
              value={dlsConfig.onFoundResponse?.value || ''}
              onChange={e => updateDataListSearch({
                onFoundResponse: { type: 'tts', value: e.target.value },
              })}
              placeholder={t('voiceRobots.action.onFoundPlaceholder', 'Нашёл! Соединяю вас с {{result}}...')}
              rows={2}
            />
            <Text variant="xs" className="text-muted-foreground space-y-1">
              {(() => {
                const rv = dlsConfig.resultVariable || 'result';
                const cols = listColumns.slice(0, 4);
                return (
                  <>
                    <span className="block">
                      <strong>{'{{' + rv + '}}'}</strong> — значение поля «{dlsConfig.returnField || 'returnField'}» из найденной строки
                    </span>
                    {cols.length > 0 && (
                      <span className="block">
                        Другие поля строки: {cols.map(c =>
                          <code key={c.key} className="bg-muted px-1 rounded text-[10px] mr-1">{'{{'}{ `${rv}_${c.key}` }{'}}'}</code>
                        )}
                        {listColumns.length > 4 && <span className="text-muted-foreground/60">...ещё {listColumns.length - 4}</span>}
                      </span>
                    )}
                    {cols.length === 0 && (
                      <span className="block text-muted-foreground/70">
                        Формат: <code className="bg-muted px-1 rounded text-[10px]">{'{{'}{'переменная_колонка'}{'}}'}</code> — например <code className="bg-muted px-1 rounded text-[10px]">{'{{'}{ `${rv}_имя` }{'}}'}</code>
                      </span>
                    )}
                  </>
                );
              })()}
            </Text>
          </VStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.action.onFoundAction', 'Действие при успешном поиске')}</Label>
            <HStack gap="8">
              <Select
                value={dlsConfig.onFoundNextState?.type || 'transfer_exten'}
                onChange={e => updateDataListSearch({
                  onFoundNextState: {
                    type: e.target.value as BotNextStateType,
                    target: dlsConfig.onFoundNextState?.target || '',
                  },
                })}
              >
                <option value="transfer_exten">{t('voiceRobots.action.transferExten', 'Перевод на номер или очередь')}</option>
                <option value="listen">{t('voiceRobots.action.listen', 'Продолжить слушать')}</option>
                <option value="switch_group">{t('voiceRobots.action.switchGroup', 'Переключить сценарий')}</option>
                <option value="hangup">{t('voiceRobots.action.hangup', 'Завершить звонок')}</option>
              </Select>
              {(dlsConfig.onFoundNextState?.type === 'transfer_exten' || !dlsConfig.onFoundNextState?.type) && (() => {
                const [ofExt = '', ofCtx = ''] = String(dlsConfig.onFoundNextState?.target || '').split('@');
                return (
                  <>
                    <Input
                      value={ofExt}
                      onChange={e => updateDataListSearch({
                        onFoundNextState: {
                          type: dlsConfig.onFoundNextState?.type || 'transfer_exten',
                          target: `${e.target.value}@${ofCtx}`,
                        },
                      })}
                      placeholder={dlsConfig.resultVariable
                        ? `авто: {{${dlsConfig.resultVariable}}}`
                        : '{{result}}'
                      }
                    />
                    <Select
                      value={ofCtx}
                      onChange={e => updateDataListSearch({
                        onFoundNextState: {
                          type: dlsConfig.onFoundNextState?.type || 'transfer_exten',
                          target: `${ofExt}@${e.target.value}`,
                        },
                      })}
                      className={!ofCtx ? 'border-destructive ring-destructive/20' : ''}
                    >
                      <option value="">{t('voiceRobots.action.selectContext', '— Выберите контекст —')}</option>
                      {contexts.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </Select>
                    {!ofCtx && (
                      <Text variant="xs" className="text-destructive">
                        {t('voiceRobots.action.contextRequired', 'Контекст обязателен для перевода')}
                      </Text>
                    )}
                  </>
                );
              })()}
            </HStack>
            <Text variant="xs" className="text-muted-foreground">
              {(() => {
                const rv = dlsConfig.resultVariable || 'result';
                return (
                  <>
                    Номер можно не вводить — если пусто, используется <code className="bg-muted px-1 rounded text-[10px]">{'{{'}{ rv }{'}}'}</code> автоматически.
                    {' '}Можно явно указать другое поле: <code className="bg-muted px-1 rounded text-[10px]">{'{{'}{ `${rv}_телефон` }{'}}'}</code>
                  </>
                );
              })()}
            </Text>
          </VStack>
        </VStack>
      )}

      {/* ═══ Section 2.5: Webhook Config (conditional) ═══ */}
      {showWebhook && (
        <VStack gap="8" className={cls.section}>
          <HStack gap="4" className={cls.sectionTitle}>
            <Globe className={cls.sectionIcon} />
            <Text>{t('voiceRobots.action.webhookTitle', 'Настройки Webhook')}</Text>
          </HStack>

          <VStack gap="4" className={cls.webhookSection}>
            <HStack align="center" gap="4" className="mt-2">
              <Label>{t('voiceRobots.action.targetWebhook', 'URL Webhook')}</Label>
              <Tooltip
                content={
                  <div className="text-xs leading-relaxed p-1">
                    <strong>{t('voiceRobots.action.webhookSpecTitle', 'Спецификация Webhook:')}</strong><br/>
                    {t('voiceRobots.action.webhookSpecDesc', 'Робот отправит POST-запрос с собранными параметрами slots и текущим контекстом звонка.')}<br/><br/>
                    <strong>{t('voiceRobots.action.webhookExpectTitle', 'Ожидаемый JSON-ответ:')}</strong><br/>
                    • <code>{`{"action": "continue_dialogue", "say_text": "...", "next_state": "listen"}`}</code> — {t('voiceRobots.action.webhookContinue', 'продолжить опрос')}<br/>
                    • <code>{`{"action": "transfer_exten", "target": "100"}`}</code> — {t('voiceRobots.action.webhookTransfer', 'перевести звонок')}<br/>
                    • <code>{`{"action": "hangup"}`}</code> — {t('voiceRobots.action.webhookHangup', 'завершить звонок')}<br/><br/>
                    <em>{t('voiceRobots.action.webhookVariables', 'Любые другие ключи можно подставить в Шаблон ответа через {{key}}.', { key: '{{key}}' })}</em>
                  </div>
                }
              >
                <div className="cursor-help inline-flex text-muted-foreground/60 hover:text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
              </Tooltip>
            </HStack>
            <Input
              value={String(action.nextState.target || '')}
              onChange={e => updateNextState({ target: e.target.value })}
              placeholder="https://api.example.com/webhook"
            />
          </VStack>

          <WebhookAuthConfig
            authMode={(action.webhookAuth?.mode as AuthMode) ?? 'none'}
            token={action.webhookAuth?.token ?? ''}
            customHeaders={action.webhookAuth?.customHeaders ?? []}
            onAuthModeChange={(mode) => onChange({
              ...action,
              webhookAuth: { mode, token: action.webhookAuth?.token, customHeaders: action.webhookAuth?.customHeaders }
            })}
            onTokenChange={(token) => onChange({
              ...action,
              webhookAuth: { mode: (action.webhookAuth?.mode as AuthMode) ?? 'bearer', token, customHeaders: action.webhookAuth?.customHeaders }
            })}
            onHeadersChange={(customHeaders) => onChange({
              ...action,
              webhookAuth: { mode: (action.webhookAuth?.mode as AuthMode) ?? 'custom', token: action.webhookAuth?.token, customHeaders }
            })}
          />

          <VStack gap="4" className={cls.webhookSection}>
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.action.webhookResponseTemplate', 'Шаблон ответа (TTS)')}</Label>
              <InfoTooltip text={t('voiceRobots.action.webhookTemplateHint', 'Переменные из ответа сервера подставляются через {{key}}. Если сервер вернёт say_text, он будет использован вместо шаблона.')} />
            </HStack>
            <Textarea
              value={action.webhookResponseTemplate || ''}
              onChange={e => onChange({ ...action, webhookResponseTemplate: e.target.value })}
              placeholder={t('voiceRobots.action.webhookTemplatePlaceholder', 'Ваш баланс: {{balance}} рублей. Следующий платёж: {{next_date}}')}
              rows={2}
            />
          </VStack>
        </VStack>
      )}

    </VStack>
  );
});

VoiceRobotActionEditor.displayName = 'VoiceRobotActionEditor';
