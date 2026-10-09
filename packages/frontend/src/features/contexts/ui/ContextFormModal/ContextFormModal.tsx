import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { CONTEXT_IDENTIFIER_MAX_LENGTH, CONTEXT_IDENTIFIER_PATTERN, isContextIdentifier } from '@krasterisk/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Checkbox, Label, Text, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import cls from './ContextFormModal.module.scss';
import { ContextIncludesEditor } from './ContextIncludesEditor';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useCreateContextMutation, useUpdateContextMutation, useGetContextsQuery, useApplyContextMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { contextsActions } from '../../model/slice/contextsSlice';
import {
  selectContextsIsModalOpen,
  selectContextsSelectedContext,
} from '../../model/selectors/contextsSelectors';

export const ContextFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(selectContextsIsModalOpen);
  const selectedContext = useAppSelector(selectContextsSelectedContext);
  const isEditing = !!selectedContext;
  const { data: contexts, isSuccess: contextsLoaded, isError: contextsLoadFailed, refetch } = useGetContextsQuery(undefined, { skip: !isOpen });
  const availableDefaultKinds = (['trunks', 'endpoints'] as const).filter((kind) => {
    if (!contextsLoaded || !contexts) return false;
    const owner = contexts.find((row) => row[`is_default_for_${kind}`]);
    return !owner || owner.uid === selectedContext?.uid;
  });

  const onClose = () => dispatch(contextsActions.closeModal());

  const [createContext, { isLoading: isCreating }] = useCreateContextMutation();
  const [updateContext, { isLoading: isUpdating }] = useUpdateContextMutation();
  const [applyContext, { isLoading: isApplying }] = useApplyContextMutation();

  const isLoading = isCreating || isUpdating || isApplying;

  const [formData, setFormData] = useState({
    name: '',
    comment: '',
    is_default_for_endpoints: false,
    is_default_for_trunks: false,
  });
  const [saveError, setSaveError] = useState(false);
  const [includeUids, setIncludeUids] = useState<number[]>([]);
  const [savedUid, setSavedUid] = useState<number | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const [includesValid, setIncludesValid] = useState(true);
  const nameValid = isContextIdentifier(formData.name);

  useEffect(() => {
    if (isOpen) {
      setSavedUid(null);
      setApplyFailed(false);
      setIncludesValid(true);
      setIncludeUids(selectedContext?.include_uids ?? []);
      setSaveError(false);
      if (selectedContext) {
        setFormData({
          name: selectedContext.name || '',
          comment: selectedContext.comment || '',
          is_default_for_endpoints: selectedContext.is_default_for_endpoints === true,
          is_default_for_trunks: selectedContext.is_default_for_trunks === true,
        });
      } else {
        setFormData({
          name: '',
          comment: '',
          is_default_for_endpoints: false,
          is_default_for_trunks: false,
        });
      }
    }
  }, [isOpen, selectedContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !contextsLoaded || !includesValid || !nameValid) return;
    setSaveError(false);
    const data = {
      name: formData.name,
      comment: formData.comment,
      include_uids: includeUids,
      ...Object.fromEntries(availableDefaultKinds.map((kind) => {
        const field = `is_default_for_${kind}` as const;
        return [field, formData[field]];
      })),
    };
    try {
      const uid = selectedContext?.uid ?? savedUid;
      const result = uid ? await updateContext({ uid, data }).unwrap() : await createContext(data).unwrap();
      setSavedUid(result.uid);
      if (result.dialplan_applied === false) { setApplyFailed(true); return; }
      onClose();
    } catch {
      setSaveError(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cls.dialog}>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('contexts.edit', 'Редактировать контекст')
              : t('contexts.add', 'Добавить контекст')}
          </DialogTitle>
        </DialogHeader>

        <VStack as="form" onSubmit={handleSubmit} autoComplete="off" max>
          <VStack gap="16" className={cls.fields} max>
            <VStack gap="8" max>
              <HStack gap="8"><Label htmlFor="context-name">
                {t('contexts.name', 'Имя контекста')} *
              </Label><InfoTooltip text={t('contexts.identifierHint')} /></HStack>
              <Input
                required
                id="context-name"
                maxLength={CONTEXT_IDENTIFIER_MAX_LENGTH}
                pattern={CONTEXT_IDENTIFIER_PATTERN.source}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={formData.name.length > 0 && !nameValid}
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  if (name === '' || (name.length <= CONTEXT_IDENTIFIER_MAX_LENGTH && /^[a-z][a-z0-9_-]*$/.test(name))) {
                    setFormData({ ...formData, name });
                  }
                }}
                placeholder={t('contexts.namePlaceholder', 'from-internal')}
              />
            </VStack>

            <VStack gap="8" max>
              <HStack gap="8"><Label htmlFor="context-comment">
                {t('contexts.description', 'Описание')}
              </Label><InfoTooltip text={t('contexts.descriptionHint')} /></HStack>
              <Input
                id="context-comment"
                maxLength={128}
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder={t('contexts.descPlaceholder', 'Внутренняя маршрутизация')}
              />
            </VStack>
            {contextsLoadFailed && <QueryErrorState message={t('contexts.loadError')} onRetry={refetch} />}
            {contextsLoaded && <ContextIncludesEditor value={includeUids} onChange={setIncludeUids} contexts={contexts ?? []} contextUid={selectedContext?.uid ?? savedUid ?? undefined} onValidityChange={setIncludesValid} />}
            {availableDefaultKinds.map((kind) => (
              <HStack key={kind} gap="8" className={cls.defaultRow}>
                <Checkbox id={`context-default-${kind}`} checked={formData[`is_default_for_${kind}`]}
                  onChange={(event) => setFormData({ ...formData, [`is_default_for_${kind}`]: event.target.checked })} />
                <Label htmlFor={`context-default-${kind}`}>{t(kind === 'trunks' ? 'contexts.defaultForTrunks' : 'contexts.defaultForEndpoints')}</Label>
                <InfoTooltip text={t('contexts.defaultContextHint')} />
              </HStack>
            ))}
            {saveError && <Text variant="error" role="alert">{t('contexts.saveError')}</Text>}
            {applyFailed && <VStack gap="8"><Text variant="error" role="alert">{t('contexts.applyFailed')}</Text>
              <Button type="button" variant="outline" disabled={isLoading} onClick={async () => {
                if (!savedUid) return;
                try { const result = await applyContext(savedUid).unwrap(); if (result.dialplan_applied) onClose(); } catch { setApplyFailed(true); }
              }}>{t('contexts.retryApply')}</Button></VStack>}
          </VStack>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="submit" disabled={isLoading || !contextsLoaded || !includesValid || !nameValid}>
              {isLoading && <Loader2 className={cls.spinner} />}
              {t('common.save', 'Сохранить')}
            </Button>
          </DialogFooter>
        </VStack>
      </DialogContent>
    </Dialog>
  );
};
