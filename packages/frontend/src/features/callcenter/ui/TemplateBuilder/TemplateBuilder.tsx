import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCardDirectorySource } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Button, Input, Textarea, Select, Checkbox, MultiSelect, Text, VStack, HStack,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui';
import {
  useCreateCardTemplateMutation,
  useUpdateCardTemplateMutation,
  useGetCardTemplateQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import {
  CARD_FIELD_TYPES,
  type CardFieldType,
  type AutoOpenOn,
  type ICardField,
} from '@/features/callcenter/model/types/callCard';
import { FieldRenderer } from '../FieldRenderer';
import { FieldRow, type BuilderField } from './FieldRow';
import { FieldConfig } from './FieldConfig';
import { FormSaveBar } from '../FormSaveBar/FormSaveBar';
import { isFieldVisible } from '../CallCardForm/CallCardForm';
import { queueDisplayName } from '../../lib/displayLabels';
import styles from './TemplateBuilder.module.scss';

export interface TemplateBuilderProps {
  templateId?: number;
  onDone: () => void;
}

function makeFieldId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createDefaultField(type: CardFieldType, index: number, label: string): BuilderField {
  return {
    id: makeFieldId(),
    field_key: `field_${index + 1}`,
    field_type: type,
    label,
    placeholder: '',
    is_required: false,
    width: type === 'divider' || type === 'heading' ? 'full' : 'full',
    sort_order: index,
    options: type === 'select' || type === 'multi_select' ? [] : null,
    depends_on: null,
    depends_values: null,
    auto_populate: null,
  };
}

export const TemplateBuilder = memo(({ templateId, onDone }: TemplateBuilderProps) => {
  const { t } = useTranslation();
  const isEdit = Boolean(templateId);
  const { data: existing, isLoading } = useGetCardTemplateQuery(templateId!, { skip: !templateId });
  const { data: queues = [] } = useGetQueuesQuery();
  const [createTemplate, { isLoading: creating }] = useCreateCardTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateCardTemplateMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoOpenOn, setAutoOpenOn] = useState<AutoOpenOn>('answer');
  const [autoSaveOnTimeout, setAutoSaveOnTimeout] = useState(true);
  const [queueNames, setQueueNames] = useState<string[]>([]);
  const [webhookIntegrationUid, setWebhookIntegrationUid] = useState<string>('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing || dirtyRef.current) return;
    setName(existing.name);
    setDescription(existing.description ?? '');
    setIsActive(existing.is_active);
    setAutoOpenOn(existing.auto_open_on);
    setAutoSaveOnTimeout(existing.auto_save_on_timeout);
    setQueueNames(existing.queue_names ?? []);
    setWebhookIntegrationUid(existing.webhook_integration_uid ? String(existing.webhook_integration_uid) : '');
    setFields(
      (existing.fields ?? []).map((f, idx) => ({
        ...f,
        id: makeFieldId(),
        sort_order: f.sort_order ?? idx,
      })),
    );
  }, [existing]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const queueOptions = useMemo(
    () => queues.map((q) => ({ value: q.name, label: queueDisplayName(q.name, [{ name: q.name, displayName: q.display_name ?? "", exten: q.exten }]) })),
    [queues],
  );

  const addField = useCallback((type: CardFieldType) => {
    setDirty(true);
    const label = t(`callcenter.cards.fieldTypes.${type}`);
    setFields((prev) => {
      let index = prev.length;
      while (prev.some(field => field.field_key === `field_${index + 1}`)) index += 1;
      const next = [...prev, createDefaultField(type, index, label)];
      setSelectedId(next[next.length - 1].id);
      return next;
    });
  }, [t]);

  const removeField = useCallback((id: string) => {
    setDirty(true);
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const updateField = useCallback((id: string, patch: Partial<ICardField>) => {
    setDirty(true);
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const toggleWidth = useCallback((id: string) => {
    setDirty(true);
    setFields((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      return { ...f, width: f.width === 'half' ? 'full' : 'half' };
    }));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDirty(true);
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((f, idx) => ({ ...f, sort_order: idx }));
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    if (!name.trim()) {
      toast.error(t('callcenter.cards.builder.nameRequired'));
      return;
    }
    if (fields.some(field => !field.label.trim() || (isCardDirectorySource(field.options) && (!field.options.directoryUid || !field.options.valueFieldUid || !field.options.labelFieldUid))) || new Set(fields.map(f => f.field_key)).size !== fields.length) {
      toast.error(t('callcenter.cards.builder.invalidFields')); return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
      auto_open_on: autoOpenOn,
      auto_save_on_timeout: autoSaveOnTimeout,
      queue_names: queueNames,
      webhook_integration_uid: webhookIntegrationUid ? Number(webhookIntegrationUid) : null,
      fields: fields.map(({ id: _id, ...f }, idx) => ({
        ...f,
        sort_order: idx,
      })),
    };

    try {
      if (isEdit && templateId) {
        await updateTemplate({ id: templateId, data: payload }).unwrap();
        toast.success(t('callcenter.cards.builder.updated'));
      } else {
        await createTemplate(payload).unwrap();
        toast.success(t('callcenter.cards.builder.created'));
      }
      setDirty(false);
      onDone();
    } catch (error) {
      const message = (error as { data?: { message?: string | string[] } })?.data?.message;
      setSaveError(Array.isArray(message) ? message.join('; ') : message || t('callcenter.cards.builder.saveError'));
      toast.error(t('callcenter.cards.builder.saveError'));
    }
  }, [
    name, description, isActive, autoOpenOn, autoSaveOnTimeout, queueNames,
    webhookIntegrationUid, fields, isEdit, templateId, createTemplate, updateTemplate, onDone, t,
  ]);

  if (isEdit && isLoading) {
    return <Text>{t('common.loading')}</Text>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.leftPane} onChangeCapture={() => setDirty(true)}>
        <VStack gap="16">
          <Text variant="muted">{t('callcenter.cards.builder.guide')}</Text>
          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.templateSettings')}</Text>
            <Input
              aria-label={t('callcenter.cards.builder.namePlaceholder')} value={name}
              placeholder={t('callcenter.cards.builder.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              aria-label={t('callcenter.cards.builder.descriptionPlaceholder')} value={description}
              placeholder={t('callcenter.cards.builder.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
            />
            <HStack gap="12" align="center">
              <Checkbox aria-label={t('callcenter.cards.builder.isActive')} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <Text>{t('callcenter.cards.builder.isActive')}</Text>
            </HStack>
            <Select aria-label={t('callcenter.cards.builder.whenOpen')} value={autoOpenOn} onChange={(e) => setAutoOpenOn(e.target.value as AutoOpenOn)}>
              <option value="answer">{t('callcenter.cards.builder.autoOpen.answer')}</option>
              <option value="ring">{t('callcenter.cards.builder.autoOpen.ring')}</option>
              <option value="manual">{t('callcenter.cards.builder.autoOpen.manual')}</option>
            </Select>
            <HStack gap="12" align="center">
              <Checkbox
                aria-label={t('callcenter.cards.builder.autoSaveOnTimeout')} checked={autoSaveOnTimeout}
                onChange={(e) => setAutoSaveOnTimeout(e.target.checked)}
              />
              <Text>{t('callcenter.cards.builder.autoSaveOnTimeout')}</Text>
            </HStack>
            <Text variant="muted">{t('callcenter.cards.builder.allQueues')}</Text>
            <MultiSelect
              value={queueNames}
              options={queueOptions}
              placeholder={t('callcenter.cards.builder.queueNamesPlaceholder')}
              onChange={(next) => { setDirty(true); setQueueNames(next); }}
            />
            <details><summary>{t('callcenter.cards.builder.advancedTemplate')}</summary><Input
              aria-label={t('callcenter.cards.builder.webhookUidPlaceholder')} type="number"
              value={webhookIntegrationUid}
              placeholder={t('callcenter.cards.builder.webhookUidPlaceholder')}
              onChange={(e) => setWebhookIntegrationUid(e.target.value)}
            /></details>
          </VStack>

          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.palette')}</Text>
            <div className={styles.palette}>
              {CARD_FIELD_TYPES.filter(type => !['phonebook_lookup', 'readonly', 'datetime', 'divider'].includes(type)).map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => addField(type)}>
                  {t(`callcenter.cards.fieldTypes.${type}`)}
                </Button>
              ))}
            </div>
            <details><summary>{t('callcenter.cards.builder.advancedTypes')}</summary><div className={styles.palette}>
              {CARD_FIELD_TYPES.filter(type => ['phonebook_lookup', 'readonly', 'datetime', 'divider'].includes(type)).map(type => <Button key={type} variant="outline" size="sm" onClick={() => addField(type)}>{t(`callcenter.cards.fieldTypes.${type}`)}</Button>)}
            </div></details>
          </VStack>

          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.fieldsList')}</Text>
            {!fields.length ? <Text variant="muted">{t('callcenter.cards.builder.addFirstField')}</Text> : null}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <VStack gap="8">
                  {fields.map((field, index) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      selected={selectedId === field.id}
                      onEdit={() => setSelectedId(field.id)}
                      onRemove={() => removeField(field.id)}
                      onToggleWidth={() => toggleWidth(field.id)}
                      onMove={(delta) => { setDirty(true); setFields(prev => arrayMove(prev, index, index + delta)); }}
                      first={index === 0}
                      last={index === fields.length - 1}
                    />
                  ))}
                </VStack>
              </SortableContext>
            </DndContext>
          </VStack>

          {selectedField ? (
            <FieldConfig
              field={selectedField}
              allFields={fields}
              onChange={(patch) => updateField(selectedField.id, patch)}
            />
          ) : null}

          <FormSaveBar dirty={dirty} saving={creating || updating} onSave={handleSave} onCancel={() => setConfirmLeave(true)} />
          {saveError ? <div role="alert">{saveError}</div> : null}
          <HStack gap="8">
            <Button variant="outline" onClick={() => dirty ? setConfirmLeave(true) : onDone()}>
              {t('common.cancel')}
            </Button>
          </HStack>
        </VStack>
      </div>

      <div className={styles.rightPane}>
        <Text className="font-medium mb-4">{t('callcenter.cards.builder.preview')}</Text>
        <div className={styles.previewGrid}>
          {fields.filter(field => isFieldVisible(field, previewValues)).map((field) => (
            <div
              key={field.id}
              className={field.width === 'half' ? styles.previewHalf : styles.previewFull}
            >
              <FieldRenderer
                preview
                field={field}
                value={previewValues[field.field_key]}
                onChange={(v) => setPreviewValues((prev) => ({ ...prev, [field.field_key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}><DialogContent><DialogHeader><DialogTitle>{t('callcenter.settings.saveBar.leaveTitle')}</DialogTitle></DialogHeader><Text>{t('callcenter.settings.saveBar.leaveBody')}</Text><DialogFooter><Button variant="outline" onClick={() => setConfirmLeave(false)}>{t('callcenter.settings.saveBar.stay')}</Button><Button variant="destructive" onClick={onDone}>{t('callcenter.settings.saveBar.leave')}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
});

TemplateBuilder.displayName = 'TemplateBuilder';
