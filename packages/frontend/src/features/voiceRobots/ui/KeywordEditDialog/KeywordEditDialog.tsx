import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Type, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  VStack, HStack, Input, Label, Text, Button, TagInput,
} from '@/shared/ui';
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
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (keyword) {
      setKeywords(keyword.keywords);
      setSynonyms(keyword.synonyms || []);
      setNegativeKeywords(keyword.negative_keywords || []);
      setComment(keyword.comment || '');
      setBotAction(keyword.bot_action || { ...DEFAULT_BOT_ACTION });
    } else {
      setKeywords('');
      setSynonyms([]);
      setNegativeKeywords([]);
      setComment('');
      setBotAction({ ...DEFAULT_BOT_ACTION });
    }
    setShowPreview(false);
  }, [keyword, isOpen]);

  const handleSave = useCallback(() => {
    if (!keywords.trim()) return;
    onSave({
      keywords: keywords.trim(),
      synonyms,
      negative_keywords: negativeKeywords,
      comment: comment.trim() || null,
      bot_action: botAction,
    });
    onClose();
  }, [keywords, synonyms, negativeKeywords, comment, botAction, onSave, onClose]);

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
            <Label>{t('voiceRobots.negativeKeywords', 'Стоп-слова')}</Label>
            <TagInput
              value={negativeKeywords}
              onChange={setNegativeKeywords}
              placeholder={t('voiceRobots.negativeKeywordsTagPlaceholder', 'Введите и нажмите Enter')}
            />
            <Text variant="xs" className="text-muted-foreground">
              {t('voiceRobots.negativeKeywordsHint', 'При наличии этих слов совпадение блокируется, даже если основная фраза распознана.')}
            </Text>
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
