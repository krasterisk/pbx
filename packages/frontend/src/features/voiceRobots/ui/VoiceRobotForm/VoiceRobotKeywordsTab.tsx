import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pencil, Trash2, Plus, ChevronRight, ChevronDown, Bot, FileText,
  MessageSquare, ArrowRight, GripVertical, Eye,
} from 'lucide-react';
import { VStack, HStack, Text, Button, Input, Label, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui';
import { IVoiceRobot, IVoiceRobotKeywordGroup, IVoiceRobotKeyword, IVoiceRobotBotAction } from '@/entities/voiceRobot';
import { KeywordEditDialog } from '../KeywordEditDialog/KeywordEditDialog';
import { ConversationPreview } from '../ConversationPreview/ConversationPreview';
import {
  useGetVoiceRobotKeywordGroupsQuery,
  useCreateVoiceRobotKeywordGroupMutation,
  useUpdateVoiceRobotKeywordGroupMutation,
  useDeleteVoiceRobotKeywordGroupMutation,
  useGetVoiceRobotKeywordsQuery,
  useCreateVoiceRobotKeywordMutation,
  useUpdateVoiceRobotKeywordMutation,
  useDeleteVoiceRobotKeywordMutation,
} from '@/shared/api/endpoints/voiceRobotsApi';

/* ────────────────────────────────────────────────────────────── */
/*  Bot Action Summary — compact display of action config        */
/* ────────────────────────────────────────────────────────────── */

const BotActionSummary = memo(({ action }: { action: IVoiceRobotBotAction | null }) => {
  const { t } = useTranslation();

  if (!action) {
    return (
      <Text variant="xs" className="text-muted-foreground/60 italic">
        {t('voiceRobots.noActionConfigured', 'Действие не настроено')}
      </Text>
    );
  }

  const responseLabel = action.response.type === 'tts'
    ? `TTS: "${(action.response.value || '').substring(0, 40)}${(action.response.value || '').length > 40 ? '...' : ''}"`
    : action.response.type === 'prompt'
    ? `Prompt: ${action.response.value}`
    : null;

  const nextStateLabels: Record<string, string> = {
    listen: t('voiceRobots.action.listen', 'Продолжить слушать'),
    switch_group: t('voiceRobots.action.switchGroup', 'Переключить сценарий'),
    transfer_queue: t('voiceRobots.action.transferQueue', 'Перевод на очередь'),
    transfer_exten: t('voiceRobots.action.transferExten', 'Перевод на номер'),
    webhook: t('voiceRobots.action.webhook', 'Webhook'),
    hangup: t('voiceRobots.action.hangup', 'Завершить'),
  };

  const nextLabel = nextStateLabels[action.nextState.type] || action.nextState.type;
  const slotsCount = action.slots?.length || 0;

  return (
    <HStack gap="8" className="flex-wrap">
      {responseLabel && (
        <HStack gap="4" className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
          <MessageSquare className="w-3 h-3" />
          <Text variant="xs">{responseLabel}</Text>
        </HStack>
      )}
      <HStack gap="4" className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
        <ArrowRight className="w-3 h-3" />
        <Text variant="xs">{nextLabel}{action.nextState.target ? ` → ${action.nextState.target}` : ''}</Text>
      </HStack>
      {slotsCount > 0 && (
        <Text variant="xs" className="text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
          {t('voiceRobots.slotsCount', '{{count}} параметров', { count: slotsCount })}
        </Text>
      )}
    </HStack>
  );
});
BotActionSummary.displayName = 'BotActionSummary';

/* ────────────────────────────────────────────────────────────── */
/*  Keyword Card — summary card, click to edit in dialog         */
/* ────────────────────────────────────────────────────────────── */

interface KeywordCardProps {
  keyword: IVoiceRobotKeyword;
  onEdit: (keyword: IVoiceRobotKeyword) => void;
  onDelete: (uid: number) => void;
  onPreview: (keyword: IVoiceRobotKeyword) => void;
}

const KeywordCard = memo(({ keyword, onEdit, onDelete, onPreview }: KeywordCardProps) => {
  const { t } = useTranslation();

  return (
    <HStack
      align="center"
      justify="between"
      className="group px-4 py-3 rounded-lg border border-border bg-background shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
      onClick={() => onEdit(keyword)}
    >
      <VStack gap="2" className="flex-1 min-w-0">
        <Text variant="small" className="font-semibold text-foreground truncate">{keyword.keywords}</Text>
        {keyword.synonyms?.length > 0 && (
          <Text variant="xs" className="text-muted-foreground truncate">
            {t('voiceRobots.synonymsLabel', 'Синонимы')}: {keyword.synonyms.join(', ')}
          </Text>
        )}
        {keyword.negative_keywords?.length > 0 && (
          <Text variant="xs" className="text-destructive/70 truncate">
            {t('voiceRobots.negativeLabel', 'Стоп-слова')}: {keyword.negative_keywords.join(', ')}
          </Text>
        )}
        {keyword.comment && (
          <Text variant="xs" className="text-muted-foreground/70 italic truncate">{keyword.comment}</Text>
        )}
        <BotActionSummary action={keyword.bot_action} />
      </VStack>
      <HStack gap="4" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        <Button
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onPreview(keyword); }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          title={t('voiceRobots.conversationPreview.title', 'Предпросмотр')}
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onEdit(keyword); }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title={t('common.edit', 'Редактировать')}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(keyword.uid); }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          title={t('common.delete', 'Удалить')}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </HStack>
    </HStack>
  );
});
KeywordCard.displayName = 'KeywordCard';

/* ────────────────────────────────────────────────────────────── */
/*  Keywords List (keywords inside one group)                    */
/* ────────────────────────────────────────────────────────────── */

interface KeywordsListProps {
  groupId: number;
  robotId: number;
}

const KeywordsList = memo(({ groupId, robotId }: KeywordsListProps) => {
  const { t } = useTranslation();
  const { data: keywords = [], isLoading } = useGetVoiceRobotKeywordsQuery(groupId);
  const [createKeyword] = useCreateVoiceRobotKeywordMutation();
  const [updateKeyword] = useUpdateVoiceRobotKeywordMutation();
  const [deleteKeyword] = useDeleteVoiceRobotKeywordMutation();

  // Edit dialog state
  const [editingKeyword, setEditingKeyword] = useState<IVoiceRobotKeyword | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Preview
  const [previewKeyword, setPreviewKeyword] = useState<IVoiceRobotKeyword | null>(null);

  const handleEdit = useCallback((kw: IVoiceRobotKeyword) => {
    setEditingKeyword(kw);
    setIsDialogOpen(true);
  }, []);

  const handlePreview = useCallback((kw: IVoiceRobotKeyword) => {
    setPreviewKeyword(kw);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingKeyword(null); // null = create mode
    setIsDialogOpen(true);
  }, []);

  const handleSave = useCallback(async (data: Partial<IVoiceRobotKeyword>) => {
    try {
      if (editingKeyword) {
        // Update existing
        await updateKeyword({ uid: editingKeyword.uid, data }).unwrap();
      } else {
        // Create new
        await createKeyword({
          groupId,
          data: {
            keywords: data.keywords || '',
            synonyms: data.synonyms || [],
            negative_keywords: data.negative_keywords || [],
            comment: data.comment || null,
            bot_action: data.bot_action || null,
            priority: keywords.length,
          },
        }).unwrap();
      }
    } catch (err) {
      console.error('Failed to save keyword:', err);
    }
  }, [editingKeyword, updateKeyword, createKeyword, groupId, keywords.length]);

  const handleDelete = useCallback(async (uid: number) => {
    try {
      await deleteKeyword(uid).unwrap();
    } catch (err) {
      console.error('Failed to delete keyword:', err);
    }
  }, [deleteKeyword]);

  if (isLoading) {
    return <Text variant="xs" className="text-muted-foreground p-2">{t('common.loading', 'Загрузка...')}</Text>;
  }

  return (
    <VStack gap="8">
      {keywords.length === 0 && (
        <Text variant="xs" className="text-muted-foreground/60 text-center p-4">
          {t('voiceRobots.noKeywords', 'Нет сценариев. Добавьте первый.')}
        </Text>
      )}

      {keywords.map((kw) => (
        <KeywordCard
          key={kw.uid}
          keyword={kw}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPreview={handlePreview}
        />
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        {t('voiceRobots.addKeyword', 'Добавить сценарий')}
      </Button>

      {/* Edit/Create Dialog */}
      <KeywordEditDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingKeyword(null); }}
        keyword={editingKeyword}
        onSave={handleSave}
        robotId={robotId}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewKeyword} onOpenChange={(open) => !open && setPreviewKeyword(null)}>
        <DialogContent size="large">
          <DialogHeader>
            <DialogTitle>{t('voiceRobots.conversationPreview.title', 'Предпросмотр сценария')}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {previewKeyword && (
              <ConversationPreview 
                keyword={previewKeyword.keywords} 
                action={previewKeyword.bot_action || { response: { type: 'none' }, nextState: { type: 'listen' } }} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </VStack>
  );
});
KeywordsList.displayName = 'KeywordsList';

/* ────────────────────────────────────────────────────────────── */
/*  Keyword Group Panel (collapsible)                            */
/* ────────────────────────────────────────────────────────────── */

interface KeywordGroupPanelProps {
  group: IVoiceRobotKeywordGroup;
  onDelete: (uid: number) => void;
  onUpdate: (uid: number, data: Partial<IVoiceRobotKeywordGroup>) => void;
  robotId: number;
}

const KeywordGroupPanel = memo(({ group, onDelete, onUpdate, robotId }: KeywordGroupPanelProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdate(group.uid, { name: editName.trim() });
    }
    setIsEditingName(false);
  };

  return (
    <VStack className="border border-border shadow-sm rounded-xl overflow-hidden bg-background">
      {/* Group Header */}
      <HStack
        align="center"
        justify="between"
        className={`px-4 py-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-muted border-b border-border' : 'bg-muted/40 hover:bg-muted'}`}
        onClick={() => !isEditingName && setIsExpanded(!isExpanded)}
      >
        <HStack gap="8" align="center" className="flex-1 min-w-0">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}

          {isEditingName ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditName(group.name); setIsEditingName(false); }}}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-sm"
            />
          ) : (
            <VStack gap="0" className="min-w-0">
              <Text variant="small" className="font-semibold truncate">{group.name}</Text>
              <Text variant="xs" className="text-muted-foreground">
                {t('voiceRobots.groupDescription', 'Группа сценариев. Робот реагирует на эти фразы в данной стадии диалога.')}
              </Text>
            </VStack>
          )}

          <HStack gap="4" className="shrink-0 ml-2">
            <Checkbox
              checked={group.active}
              onChange={(e) => { e.stopPropagation(); onUpdate(group.uid, { active: e.target.checked }); }}
              title={t('common.active', 'Активна')}
            />
          </HStack>
        </HStack>

        <HStack gap="4" className="shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            onClick={() => { setEditName(group.name); setIsEditingName(true); }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title={t('common.edit', 'Редактировать')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onDelete(group.uid)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </HStack>
      </HStack>

      {/* Expanded Contents */}
      {isExpanded && (
        <div className="p-4 pt-6 bg-muted/5">
          <div className="pl-6 border-l-2 border-primary/20 ml-2 py-1">
            <KeywordsList groupId={group.uid} robotId={robotId} />
          </div>
        </div>
      )}
    </VStack>
  );
});
KeywordGroupPanel.displayName = 'KeywordGroupPanel';

/* ────────────────────────────────────────────────────────────── */
/*  Dialogue Tab (top-level)                                     */
/* ────────────────────────────────────────────────────────────── */

interface VoiceRobotDialogueTabProps {
  selectedRobot: IVoiceRobot | null;
}

export const VoiceRobotDialogueTab = memo(({ selectedRobot }: VoiceRobotDialogueTabProps) => {
  const { t } = useTranslation();

  const { data: groups = [], isLoading } = useGetVoiceRobotKeywordGroupsQuery(
    selectedRobot?.uid ?? 0,
    { skip: !selectedRobot },
  );
  const [createGroup] = useCreateVoiceRobotKeywordGroupMutation();
  const [updateGroup] = useUpdateVoiceRobotKeywordGroupMutation();
  const [deleteGroup] = useDeleteVoiceRobotKeywordGroupMutation();

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleAddGroup = useCallback(async () => {
    if (!newGroupName.trim() || !selectedRobot) return;
    try {
      await createGroup({
        robotId: selectedRobot.uid,
        data: {
          name: newGroupName.trim(),
          priority: groups.length,
          active: true,
        },
      }).unwrap();
      setNewGroupName('');
      setIsAddingGroup(false);
    } catch (err) {
      console.error('Failed to create keyword group:', err);
    }
  }, [createGroup, selectedRobot, newGroupName, groups.length]);

  const handleUpdateGroup = useCallback(async (uid: number, data: Partial<IVoiceRobotKeywordGroup>) => {
    try {
      await updateGroup({ id: uid, data }).unwrap();
    } catch (err) {
      console.error('Failed to update keyword group:', err);
    }
  }, [updateGroup]);

  const handleDeleteGroup = useCallback(async (uid: number) => {
    try {
      await deleteGroup(uid).unwrap();
    } catch (err) {
      console.error('Failed to delete keyword group:', err);
    }
  }, [deleteGroup]);

  /* Robot not saved yet */
  if (!selectedRobot) {
    return (
      <VStack align="center" justify="center" gap="8" className="py-16 border border-dashed border-border/50 rounded-lg bg-background/30">
        <Bot className="w-12 h-12 text-muted-foreground/50" />
        <Text variant="h3" className="text-muted-foreground">{t('voiceRobots.dialogueScenarios', 'Сценарии диалога')}</Text>
        <Text variant="muted" className="text-center max-w-md">
          {t('voiceRobots.saveRobotFirst', 'Сначала сохраните базовые настройки робота.')}
        </Text>
      </VStack>
    );
  }

  if (isLoading) {
    return (
      <VStack align="center" className="py-16">
        <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
      </VStack>
    );
  }

  return (
    <VStack gap="12">
      {/* Header */}
      <HStack align="center" justify="between">
        <VStack gap="2">
          <Text variant="small" className="font-semibold">
            {t('voiceRobots.dialogueScenarios', 'Сценарии диалога')}
          </Text>
          <Text variant="xs" className="text-muted-foreground">
            {t('voiceRobots.dialogueScenariosDescription', 'Группа определяет «стадию» разговора. Ключевые слова внутри — это варианты фраз клиента, на которые реагирует робот на этой стадии.')}
          </Text>
        </VStack>
      </HStack>

      {/* Groups */}
      {groups.map((group) => (
        <KeywordGroupPanel
          key={group.uid}
          group={group}
          onDelete={handleDeleteGroup}
          onUpdate={handleUpdateGroup}
          robotId={selectedRobot.uid}
        />
      ))}

      {/* Empty state */}
      {groups.length === 0 && !isAddingGroup && (
        <VStack align="center" justify="center" gap="8" className="py-10 border border-dashed border-border/50 rounded-lg bg-background/30">
          <FileText className="w-12 h-12 text-muted-foreground/50" />
          <Text variant="muted" className="text-center max-w-sm">
            {t('voiceRobots.noDialogueGroups', 'Нет сценариев. Создайте первую группу для начала настройки робота.')}
          </Text>
        </VStack>
      )}

      {/* Add group form */}
      {isAddingGroup ? (
        <VStack gap="8" className="p-4 border border-dashed border-primary/40 rounded-xl bg-primary/5">
          <VStack gap="4">
            <Label>{t('voiceRobots.groupName', 'Название группы')}</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('voiceRobots.groupNamePlaceholder', 'Основное меню')}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); if (e.key === 'Escape') { setIsAddingGroup(false); setNewGroupName(''); }}}
            />
          </VStack>
          <HStack gap="8" justify="end">
            <Button variant="ghost" onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              {t('voiceRobots.createGroup', 'Создать группу')}
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsAddingGroup(true)}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('voiceRobots.addDialogueGroup', 'Добавить группу сценариев')}
        </Button>
      )}
    </VStack>
  );
});

VoiceRobotDialogueTab.displayName = 'VoiceRobotDialogueTab';
