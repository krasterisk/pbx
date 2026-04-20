import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, ArrowRight, SlidersHorizontal, Plus, Trash2, Globe,
  Headphones, GitBranch, PhoneForwarded, PhoneOff,
} from 'lucide-react';
import { VStack, HStack, Input, Select, Label, Button, Text, Textarea, RadioCards } from '@/shared/ui';
import { InfoTooltip, Tooltip } from '@/shared/ui/Tooltip/Tooltip';
import {
  IVoiceRobotBotAction,
  IBotResponse,
  IBotNextState,
  ISlotDefinition,
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

  // ─── Webhook ────────────────────────────────────
  const showWebhook = action.nextState.type === 'webhook';

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
              <Label>{t('voiceRobots.action.targetExtenCtx', 'Контекст')}</Label>
              <Select
                value={tCtx}
                onChange={e => updateNextState({ target: `${tExt}@${e.target.value}` })}
              >
                <option value="">{t('voiceRobots.action.selectContext', '— Выберите контекст —')}</option>
                {contexts.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </Select>
            </VStack>
          </HStack>
        )}
      </VStack>

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
