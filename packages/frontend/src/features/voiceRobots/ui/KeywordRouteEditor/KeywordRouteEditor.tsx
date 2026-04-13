import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, VStack, Flex, Label, Text } from '@/shared/ui';
import { DialplanAppsEditor } from '@/features/dialplan-apps';
import { IVoiceRobotKeyword } from '@/entities/voiceRobot';
import { IRouteAction } from '@/shared/api/api';

interface KeywordRouteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  keywordData: IVoiceRobotKeyword | null;
  onSave: (data: Partial<IVoiceRobotKeyword>) => void;
}

export const KeywordRouteEditor = memo(({ isOpen, onClose, keywordData, onSave }: KeywordRouteEditorProps) => {
  const { t } = useTranslation();

  const [keywords, setKeywords] = useState('');
  const [priority, setPriority] = useState(10);
  const [actions, setActions] = useState<IRouteAction[]>([]);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (keywordData) {
      setKeywords(keywordData.keywords);
      setPriority(keywordData.priority);
      setActions(keywordData.actions || []);
      setSynonyms(keywordData.synonyms || []);
      setNegativeKeywords(keywordData.negative_keywords || []);
      setComment(keywordData.comment || '');
    } else {
      setKeywords('');
      setPriority(10);
      setActions([]);
      setSynonyms([]);
      setNegativeKeywords([]);
      setComment('');
    }
  }, [keywordData, isOpen]);

  const handleSave = () => {
    onSave({
      keywords,
      priority,
      actions,
      synonyms,
      negative_keywords: negativeKeywords,
      comment,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {keywordData ? 'Редактировать паттерн' : 'Добавить паттерн фраз'}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className="py-4">
          <Flex className="grid grid-cols-2 gap-4">
            <VStack gap="4">
              <Label>Основные ключевые фразы (через запятую)</Label>
              <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="бухгалтерия, соедини с" />
            </VStack>
            <VStack gap="4">
              <Label>Приоритет перехвата</Label>
              <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
            </VStack>
          </Flex>

          <VStack gap="4">
            <Label>Минус-слова (перехват отменяется)</Label>
            <Input value={negativeKeywords.join(', ')} onChange={e => setNegativeKeywords(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="ошибка, нет, не соединяй" />
          </VStack>

          <VStack gap="4" className="mt-4">
            <Label className="text-primary">Цепочка действий (Routing Flow)</Label>
            <Flex className="border border-border/50 rounded-lg p-4 bg-muted/20 w-full">
              <DialplanAppsEditor actions={actions} onChange={setActions} />
            </Flex>
          </VStack>
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSave} disabled={!keywords.trim()}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

KeywordRouteEditor.displayName = 'KeywordRouteEditor';
