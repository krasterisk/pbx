import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Type, Eye, ChevronDown, ChevronUp, Repeat, ShieldAlert, Tag } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  VStack, HStack, Input, Label, Text, Button, TagInput,
} from '@/shared/ui';
import { Tooltip } from '@/shared/ui/Tooltip/Tooltip';
import { VoiceRobotActionEditor } from '../VoiceRobotActionEditor/VoiceRobotActionEditor';
import { IVoiceRobotKeyword, IVoiceRobotBotAction } from '@/entities/voiceRobot';
import cls from './KeywordEditDialog.module.scss';

const DEFAULT_BOT_ACTION: IVoiceRobotBotAction = {
  response: { type: 'none' },
  nextState: { type: 'listen' },
};

interface KeywordEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  keyword: IVoiceRobotKeyword | null;
  onSave: (data: Partial<IVoiceRobotKeyword>) => void;
  robotId: number;
}

/**
 * KeywordEditDialog — full-screen dialog for editing a keyword scenario.
 *
 * Contains: keyword phrase, synonyms (TagInput), negative keywords (TagInput),
 * comment, VoiceRobotActionEditor, and collapsible ConversationPreview.
 *
 * Replaces inline editing in KeywordsTab for better UX with complex action configs.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const KeywordEditDialog = memo(({
  isOpen, onClose, keyword, onSave, robotId,
}: KeywordEditDialogProps) => {
  const { t } = useTranslation();

  const [keywords, setKeywords] = useState('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [botAction, setBotAction] = useState<IVoiceRobotBotAction>(DEFAULT_BOT_ACTION);
  const [maxRepeats, setMaxRepeats] = useState(0);
  const [escalationAction, setEscalationAction] = useState<IVoiceRobotBotAction>(DEFAULT_BOT_ACTION);
  const [showEscalation, setShowEscalation] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tag, setTag] = useState('');

  useEffect(() => {
    if (keyword) {
      setKeywords(keyword.keywords);
      setSynonyms(keyword.synonyms || []);
      setNegativeKeywords(keyword.negative_keywords || []);
      setComment(keyword.comment || '');
      setBotAction(keyword.bot_action || { ...DEFAULT_BOT_ACTION });
      setMaxRepeats(keyword.max_repeats || 0);
      setEscalationAction(keyword.escalation_action || { ...DEFAULT_BOT_ACTION });
      setShowEscalation((keyword.max_repeats || 0) > 0);
      setTag(keyword.tag || '');
    } else {
      setKeywords('');
      setSynonyms([]);
      setNegativeKeywords([]);
      setComment('');
      setBotAction({ ...DEFAULT_BOT_ACTION });
      setMaxRepeats(0);
      setEscalationAction({ ...DEFAULT_BOT_ACTION });
      setShowEscalation(false);
      setTag('');
    }
    setShowPreview(false);
  }, [keyword, isOpen]);

  /** Strip fields irrelevant to the selected nextState type */
  const sanitizeBotAction = useCallback((a: IVoiceRobotBotAction): IVoiceRobotBotAction => {
    const clean = { ...a };
    const type = clean.nextState?.type;

    // Clear webhook-specific fields if not webhook
    if (type !== 'webhook') {
      delete clean.webhookAuth;
      delete clean.webhookResponseTemplate;
    }

    // Clear data list search config if not search_data_list
    if (type !== 'search_data_list') {
      delete clean.dataListSearch;
    }

    // Clear target for types that don't use it
    if (type === 'listen' || type === 'hangup') {
      clean.nextState = { ...clean.nextState, target: '' };
    }

    return clean;
  }, []);

  const handleSave = useCallback(() => {
    if (!keywords.trim()) return;
    onSave({
      keywords: keywords.trim(),
      synonyms,
      negative_keywords: negativeKeywords,
      comment: comment.trim() || null,
      tag: tag.trim() || null,
      bot_action: sanitizeBotAction(botAction),
      max_repeats: maxRepeats,
      escalation_action: maxRepeats > 0 ? sanitizeBotAction(escalationAction) : null,
    });
    onClose();
  }, [keywords, synonyms, negativeKeywords, comment, tag, botAction, maxRepeats, escalationAction, onSave, onClose, sanitizeBotAction]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {keyword
              ? t('voiceRobots.keyword.edit', 'Редактировать сценарий')
              : t('voiceRobots.keyword.add', 'Новый сценарий')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className="flex-1 overflow-y-auto px-1 pb-2">
          {/* ═══ Keyword Phrase ═══ */}
          <VStack gap="4">
            <HStack gap="4" align="center">
              <Type className={cls.sectionIcon} />
              <Label>{t('voiceRobots.keywordPhrase', 'Ключевая фраза')}</Label>
            </HStack>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t('voiceRobots.keywordPhrasePlaceholder', 'соединить с менеджером')}
              autoFocus
            />
          </VStack>

          {/* ═══ Synonyms (TagInput) ═══ */}
          <VStack gap="4">
            <Label>{t('voiceRobots.synonyms', 'Синонимы')}</Label>
            <TagInput
              value={synonyms}
              onChange={setSynonyms}
              placeholder={t('voiceRobots.synonymsTagPlaceholder', 'Введите и нажмите Enter')}
            />
            <Text variant="xs" className="text-muted-foreground">
              {t('voiceRobots.synonymsHint', 'Альтернативные фразы, которые должны срабатывать как этот сценарий.')}
            </Text>
          </VStack>

          {/* ═══ Negative Keywords (TagInput) ═══ */}
          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.negativeKeywords', 'Стоп-слова')}</Label>
              <Tooltip
                content={
                  <VStack gap="2" className="text-xs leading-relaxed p-1 max-w-[320px]">
                    <Text as="span" className="font-semibold">{t('voiceRobots.negativeTooltipTitle')}</Text>
                    <Text as="span">{t('voiceRobots.negativeTooltipDesc')}</Text>
                    <VStack gap="2" className="mt-2">
                      <Text as="span" className="font-semibold">{t('voiceRobots.negativeTooltipExampleTitle')}</Text>
                      <Text as="span">• {t('voiceRobots.negativeTooltipExample1')}</Text>
                      <Text as="span">• {t('voiceRobots.negativeTooltipExample2')}</Text>
                    </VStack>
                    <Text as="span" className="italic mt-2">{t('voiceRobots.negativeTooltipExample3')}</Text>
                  </VStack>
                }
              >
                <HStack align="center" className="cursor-help text-muted-foreground/60 hover:text-muted-foreground inline-flex">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </HStack>
              </Tooltip>
            </HStack>
            <TagInput
              value={negativeKeywords}
              onChange={setNegativeKeywords}
              placeholder={t('voiceRobots.negativeKeywordsTagPlaceholder', 'Введите и нажмите Enter')}
            />
          </VStack>

          {/* ═══ Comment ═══ */}
          <VStack gap="4">
            <Label>{t('voiceRobots.comment', 'Комментарий')}</Label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('voiceRobots.commentPlaceholder', 'Заметка для администратора...')}
            />
          </VStack>

          {/* ═══ Custom Tag ═══ */}
          <VStack gap="4">
            <HStack gap="4" align="center">
              <Tag className={cls.sectionIcon} />
              <Label>{t('voiceRobots.customTag', 'Кастомный тег')}</Label>
            </HStack>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder={t('voiceRobots.customTagPlaceholder', 'Лицевой счёт, Тариф, Оплата...')}
            />
            <Text variant="xs" className="text-muted-foreground">
              {t('voiceRobots.customTagHint', 'Если указан, используется вместо имени группы в CDR-тегах. Позволяет отслеживать тему разговора.')}
            </Text>
          </VStack>

          {/* ═══ Bot Action ═══ */}
          <VStack gap="4" className={cls.sectionDivider}>
            <HStack gap="4" align="center">
              <MessageSquare className={cls.sectionIcon} />
              <Text className={cls.sectionLabel}>
                {t('voiceRobots.botActionTitle', 'Действие при совпадении')}
              </Text>
            </HStack>
            <Text variant="xs" className="text-muted-foreground">
              {t('voiceRobots.botActionHint', 'Настройте ответ робота, сбор данных и переход к следующему шагу диалога.')}
            </Text>
            <VoiceRobotActionEditor action={botAction} onChange={setBotAction} robotId={robotId} />
          </VStack>

          {/* ═══ Escalation (Repeat Counter) ═══ */}
          <VStack gap="4" className={cls.sectionDivider}>
            <HStack gap="4" align="center">
              <Repeat className={cls.sectionIcon} />
              <Button
                variant="ghost"
                onClick={() => {
                  const next = !showEscalation;
                  setShowEscalation(next);
                  if (next && maxRepeats === 0) setMaxRepeats(1);
                  if (!next) setMaxRepeats(0);
                }}
                className="justify-start px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showEscalation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <Text variant="small" className="ml-1 font-semibold text-foreground">
                  {t('voiceRobots.escalation.title', 'При повторном совпадении')}
                </Text>
              </Button>
            </HStack>

            {showEscalation && (
              <VStack gap="8" className="pl-4 border-l-2 border-primary/30">
                <Text variant="xs" className="text-muted-foreground">
                  {t('voiceRobots.escalation.hint', 'Если клиент повторяет эту фразу больше N раз, робот выполнит альтернативное действие вместо основного.')}
                </Text>

                <HStack gap="8" align="end">
                  <VStack gap="4" className="w-[200px]">
                    <Label>{t('voiceRobots.escalation.maxRepeats', 'Количество повторений')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxRepeats}
                      onChange={e => setMaxRepeats(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </VStack>
                  <Text variant="xs" className="text-muted-foreground pb-2">
                    {t('voiceRobots.escalation.repeatsExplain', 'Основное действие сработает {{count}} раз, затем — альтернативное.', { count: maxRepeats })}
                  </Text>
                </HStack>

                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <Text className="text-sm font-semibold text-foreground">
                      {t('voiceRobots.escalation.actionTitle', 'Альтернативное действие')}
                    </Text>
                  </HStack>
                  <VoiceRobotActionEditor action={escalationAction} onChange={setEscalationAction} robotId={robotId} />
                </VStack>
              </VStack>
            )}
          </VStack>
        </VStack>

        <DialogFooter className="mt-4 pt-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSave} disabled={!keywords.trim()}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

KeywordEditDialog.displayName = 'KeywordEditDialog';
