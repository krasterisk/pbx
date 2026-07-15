import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (!existing) return;
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
    () => queues.map((q) => ({ value: q.name, label: q.name })),
    [queues],
  );

  const addField = useCallback((type: CardFieldType) => {
    const label = t(`callcenter.cards.fieldTypes.${type}`);
    setFields((prev) => {
      const next = [...prev, createDefaultField(type, prev.length, label)];
      setSelectedId(next[next.length - 1].id);
      return next;
    });
  }, [t]);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const updateField = useCallback((id: string, patch: Partial<ICardField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const toggleWidth = useCallback((id: string) => {
    setFields((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      return { ...f, width: f.width === 'half' ? 'full' : 'half' };
    }));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((f, idx) => ({ ...f, sort_order: idx }));
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error(t('callcenter.cards.builder.nameRequired'));
      return;
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
      onDone();
    } catch {
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
      <div className={styles.leftPane}>
        <VStack gap="16">
          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.templateSettings')}</Text>
            <Input
              value={name}
              placeholder={t('callcenter.cards.builder.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              value={description}
              placeholder={t('callcenter.cards.builder.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
            />
            <HStack gap="12" align="center">
              <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <Text>{t('callcenter.cards.builder.isActive')}</Text>
            </HStack>
            <Select value={autoOpenOn} onChange={(e) => setAutoOpenOn(e.target.value as AutoOpenOn)}>
              <option value="answer">{t('callcenter.cards.builder.autoOpen.answer')}</option>
              <option value="ring">{t('callcenter.cards.builder.autoOpen.ring')}</option>
              <option value="manual">{t('callcenter.cards.builder.autoOpen.manual')}</option>
            </Select>
            <HStack gap="12" align="center">
              <Checkbox
                checked={autoSaveOnTimeout}
                onChange={(e) => setAutoSaveOnTimeout(e.target.checked)}
              />
              <Text>{t('callcenter.cards.builder.autoSaveOnTimeout')}</Text>
            </HStack>
            <MultiSelect
              value={queueNames}
              options={queueOptions}
              placeholder={t('callcenter.cards.builder.queueNamesPlaceholder')}
              onChange={setQueueNames}
            />
            <Input
              type="number"
              value={webhookIntegrationUid}
              placeholder={t('callcenter.cards.builder.webhookUidPlaceholder')}
              onChange={(e) => setWebhookIntegrationUid(e.target.value)}
            />
          </VStack>

          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.palette')}</Text>
            <div className={styles.palette}>
              {CARD_FIELD_TYPES.map((type) => (
                <Button key={type} variant="outline" size="sm" onClick={() => addField(type)}>
                  {t(`callcenter.cards.fieldTypes.${type}`)}
                </Button>
              ))}
            </div>
          </VStack>

          <VStack gap="8">
            <Text className="font-medium">{t('callcenter.cards.builder.fieldsList')}</Text>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <VStack gap="8">
                  {fields.map((field) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      selected={selectedId === field.id}
                      onEdit={() => setSelectedId(field.id)}
                      onRemove={() => removeField(field.id)}
                      onToggleWidth={() => toggleWidth(field.id)}
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

          <HStack gap="8">
            <Button onClick={handleSave} disabled={creating || updating}>
              {isEdit ? t('callcenter.cards.builder.saveTemplate') : t('callcenter.cards.builder.createTemplate')}
            </Button>
            <Button variant="outline" onClick={onDone}>
              {t('common.cancel')}
            </Button>
          </HStack>
        </VStack>
      </div>

      <div className={styles.rightPane}>
        <Text className="font-medium mb-4">{t('callcenter.cards.builder.preview')}</Text>
        <div className={styles.previewGrid}>
          {fields.map((field) => (
            <div
              key={field.id}
              className={field.width === 'half' ? styles.previewHalf : styles.previewFull}
            >
              <FieldRenderer
                field={field}
                value={previewValues[field.field_key]}
                onChange={(v) => setPreviewValues((prev) => ({ ...prev, [field.field_key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

TemplateBuilder.displayName = 'TemplateBuilder';
