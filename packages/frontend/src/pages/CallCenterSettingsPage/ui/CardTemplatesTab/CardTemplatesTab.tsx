import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Button, Text, VStack, HStack, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui';
import {
  useGetCardTemplatesQuery,
  useDeleteCardTemplateMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { TemplateBuilder } from '@/features/callcenter/ui/TemplateBuilder';

type ViewMode = 'list' | 'create' | 'edit';

export function CardTemplatesTab() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading, refetch } = useGetCardTemplatesQuery();
  const [deleteTemplate] = useDeleteCardTemplateMutation();
  const [mode, setMode] = useState<ViewMode>('list');
  const [editId, setEditId] = useState<number | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const handleDone = useCallback(() => {
    setMode('list');
    setEditId(undefined);
    refetch();
  }, [refetch]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await deleteTemplate(confirmDelete.id).unwrap();
      toast.success(t('callcenter.cards.builder.deleted'));
      setConfirmDelete(null);
    } catch {
      toast.error(t('callcenter.cards.builder.deleteError'));
    }
  }, [confirmDelete, deleteTemplate, t]);

  if (mode === 'create') {
    return <TemplateBuilder onDone={handleDone} />;
  }

  if (mode === 'edit' && editId) {
    return <TemplateBuilder templateId={editId} onDone={handleDone} />;
  }

  return (
    <VStack gap="16" className="w-full">
      <HStack justify="between" align="center" className="w-full">
        <Text className="font-medium">{t('callcenter.cards.builder.listTitle')}</Text>
        <Button size="sm" onClick={() => setMode('create')}>
          <Plus className="w-4 h-4 mr-1" />
          {t('callcenter.cards.builder.createTemplate')}
        </Button>
      </HStack>

      {isLoading ? (
        <Text>{t('common.loading')}</Text>
      ) : templates.length === 0 ? (
        <VStack gap="12" align="center" className="py-12">
          <Text variant="muted">{t('callcenter.cards.builder.empty')}</Text>
          <Button onClick={() => setMode('create')}>
            <Plus className="w-4 h-4 mr-1" />
            {t('callcenter.cards.builder.createTemplate')}
          </Button>
        </VStack>
      ) : (
        <VStack gap="8" className="w-full">
          {templates.map((tpl) => (
            <HStack
              key={tpl.uid}
              justify="between"
              align="center"
              className="w-full p-4 border border-border rounded-lg"
            >
              <VStack gap="4">
                <Text className="font-medium">{tpl.name}</Text>
                <HStack gap="8" wrap="wrap">
                  <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                    {tpl.is_active ? t('callcenter.cards.builder.active') : t('callcenter.cards.builder.inactive')}
                  </Badge>
                  <Badge variant="outline">{t(`callcenter.cards.builder.autoOpen.${tpl.auto_open_on}`)}</Badge>
                  {(tpl.queue_names ?? []).map((q) => (
                    <Badge key={q} variant="secondary">{q}</Badge>
                  ))}
                </HStack>
              </VStack>
              <HStack gap="8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditId(tpl.uid); setMode('edit'); }}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  {t('common.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setConfirmDelete({ id: tpl.uid, name: tpl.name })}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t('common.delete')}
                </Button>
              </HStack>
            </HStack>
          ))}
        </VStack>
      )}

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.cards.builder.confirmDelete', { name: confirmDelete?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
