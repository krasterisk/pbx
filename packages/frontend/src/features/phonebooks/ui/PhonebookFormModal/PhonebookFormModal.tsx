import { memo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Input, Text, Label, Checkbox, Select, InfoTooltip } from '@/shared/ui';
import { useGetContextsQuery } from '@/shared/api/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreatePhonebookMutation,
  useUpdatePhonebookMutation,
  useImportPhonebookCsvMutation,
} from '@/shared/api/endpoints/phonebookApi';
import { phonebooksActions } from '../../model/slice/phonebooksSlice';
import {
  getPhonebooksEditingItem,
  getPhonebooksModalMode,
} from '../../model/selectors/phonebooksSelectors';
import { DialplanAppsEditor } from '@/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor';
import type { IRouteAction } from '@krasterisk/shared';
import cls from './PhonebookFormModal.module.scss';

interface PhonebookEntry {
  number: string;
  label: string;
  dialto_context?: string;
  dialto_exten?: string;
}

const TABS = ['entries', 'actions'] as const;

export const PhonebookFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const editingItem = useAppSelector(getPhonebooksEditingItem);
  const mode = useAppSelector(getPhonebooksModalMode);

  const isCreateMode = mode === 'create' || mode === 'copy';

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('entries');
  const [name, setName] = useState(mode === 'copy' ? '' : (editingItem?.name || ''));
  const [description, setDescription] = useState(editingItem?.description || '');
  const [invert, setInvert] = useState(!!editingItem?.invert);
  const [actions, setActions] = useState<IRouteAction[]>(editingItem?.actions || []);
  const [entries, setEntries] = useState<PhonebookEntry[]>(
    (editingItem as any)?.entries?.map((e: any) => ({
      number: e.number,
      label: e.label || '',
      dialto_context: e.dialto_context || undefined,
      dialto_exten: e.dialto_exten || undefined,
    })) || [],
  );
  const [expandedDialto, setExpandedDialto] = useState<Set<number>>(new Set());
  const { data: contexts = [] } = useGetContextsQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createPhonebook, { isLoading: isCreating }] = useCreatePhonebookMutation();
  const [updatePhonebook, { isLoading: isUpdating }] = useUpdatePhonebookMutation();
  const [importCsv] = useImportPhonebookCsvMutation();

  const handleClose = useCallback(() => {
    dispatch(phonebooksActions.closeModal());
  }, [dispatch]);

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, { number: '', label: '' }]);
  }, []);

  const toggleDialto = useCallback((index: number) => {
    setExpandedDialto(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        // Clear dialto fields when collapsing
        setEntries(p => p.map((e, i) => i === index ? { ...e, dialto_context: undefined, dialto_exten: undefined } : e));
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateEntry = useCallback((index: number, field: keyof PhonebookEntry, value: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value || undefined } : e));
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      let text = evt.target?.result as string;
      if (!text) return;

      // Strip BOM
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      // Auto-detect delimiter: count semicolons vs commas in first data line
      const firstLine = lines[0];
      const semicolons = (firstLine.match(/;/g) || []).length;
      const commas = (firstLine.match(/,/g) || []).length;
      const delimiter = semicolons >= commas ? ';' : ',';

      const newEntries: PhonebookEntry[] = [];
      for (const line of lines) {
        // Skip header rows
        if (/^(number|номер|phone|телефон|#)/i.test(line)) continue;

        const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts[0] && parts[0].length >= 3) {
          newEntries.push({
            number: parts[0],
            label: parts[1] || '',
            dialto_context: parts[2] || undefined,
            dialto_exten: parts[3] || undefined,
          });
        }
      }

      if (newEntries.length > 0) {
        setEntries(prev => [...prev, ...newEntries]);
      }
    };
    reader.readAsText(file, 'utf-8');

    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    const validEntries = entries.filter(e => e.number.trim().length >= 3);
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      invert,
      actions,
      entries: validEntries.map(e => ({
        number: e.number.trim(),
        label: e.label.trim(),
        dialto_context: e.dialto_context || undefined,
        dialto_exten: e.dialto_exten?.trim() || undefined,
      })),
    };

    try {
      if (!isCreateMode && editingItem) {
        await updatePhonebook({ uid: editingItem.uid, data: payload }).unwrap();
      } else {
        await createPhonebook(payload).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save phonebook:', err);
    }
  }, [name, description, invert, actions, entries, isCreateMode, editingItem, createPhonebook, updatePhonebook, handleClose]);

  const isSaving = isCreating || isUpdating;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent size="large">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold">
            {mode === 'edit'
              ? t('phonebooks.editTitle', 'Редактировать справочник')
              : mode === 'copy'
                ? t('phonebooks.copyTitle', 'Копировать справочник')
                : t('phonebooks.createTitle', 'Новый справочник')
            }
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <VStack className="border-b border-border/50 mb-6 shrink-0" max>
          <HStack gap="8" className="-mb-[1px] flex overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`relative py-3 px-1 rounded-none text-sm font-medium transition-colors whitespace-nowrap shrink-0 outline-none ${
                    activeTab === tab ? 'text-primary bg-transparent hover:bg-transparent hover:text-primary' : 'text-muted-foreground bg-transparent hover:text-foreground hover:bg-transparent'
                }`}
              >
                {t(`phonebooks.tab.${tab}`, tab === 'entries' ? 'Номера' : 'Действия')}
                {activeTab === tab && (
                  <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>

        <VStack className="flex-1 overflow-y-auto pr-1">
          {/* General fields — always visible */}
          <VStack gap="16">
            <HStack className={cls.formGrid}>
              <VStack>
                <Label className={cls.fieldLabel}>
                  {t('phonebooks.name', 'Название')} *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('phonebooks.namePlaceholder', 'VIP-клиенты')}
                  autoFocus
                />
              </VStack>
              <VStack>
                <Label className={cls.fieldLabel}>
                  {t('phonebooks.description', 'Описание')}
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('phonebooks.descriptionPlaceholder', 'Приоритетные клиенты')}
                />
              </VStack>
            </HStack>

            {/* Invert switch */}
            <HStack align="center" justify="between" className={cls.invertSwitch}>
              <HStack align="center" gap="8">
                <Label className="cursor-pointer" htmlFor="phonebook-invert">
                  {t('phonebooks.invertLabel', 'Инвертировать (whitelist-режим)')}
                </Label>
                <InfoTooltip text={t('phonebooks.invertTooltip', 'При включении действия выполняются для номеров, которых НЕТ в справочнике. Полезно для режима «белый список».')} />
              </HStack>
              <Checkbox
                id="phonebook-invert"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
              />
            </HStack>
          </VStack>

          {/* Tab: Entries */}
          {activeTab === 'entries' && (
            <VStack gap="12" className={cls.entriesArea}>
              <VStack gap="8">
                <Text variant="muted" className={cls.fieldLabel}>
                  {t('phonebooks.entriesLabel', 'Номера телефонов')} ({entries.length})
                </Text>
                <HStack gap="4" className={cls.entryActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className={cls.removeEntryIcon} />
                    {t('phonebooks.importCsv', 'Импорт CSV')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={addEntry}>
                    <Plus className={cls.removeEntryIcon} />
                    {t('phonebooks.addEntry', 'Добавить номер')}
                  </Button>
                </HStack>
                <Text variant="muted" className="text-xs">
                  {t('phonebooks.csvHint', 'CSV-файл: разделители «;» или «,». Формат: номер;описание')}
                </Text>
              </VStack>

              {/* Entries list header */}
              {entries.length > 0 && (
                <HStack className={cls.entryHeader}>
                  <Text variant="muted" className={cls.fieldLabel}>
                    {t('phonebooks.numberColumn', 'Номер')}
                  </Text>
                  <Text variant="muted" className={cls.fieldLabel}>
                    {t('phonebooks.labelColumn', 'Метка')}
                  </Text>
                  <VStack>{''}</VStack>
                </HStack>
              )}

              {/* Entries list */}
              {entries.map((entry, i) => {
                const hasDialto = expandedDialto.has(i) || !!entry.dialto_context || !!entry.dialto_exten;
                const isOpen = expandedDialto.has(i) || !!entry.dialto_context;

                return (
                  <VStack key={i} gap="0" className="border border-border rounded-md bg-background overflow-hidden">
                    <HStack className={cls.entryRow} style={{ padding: '0.5rem', borderBottom: isOpen ? '1px solid hsl(var(--border) / 0.5)' : 'none' }}>
                      <Input
                        value={entry.number}
                        onChange={(e) => updateEntry(i, 'number', e.target.value)}
                        placeholder="+79001234567"
                      />
                      <Input
                        value={entry.label}
                        onChange={(e) => updateEntry(i, 'label', e.target.value)}
                        placeholder={t('phonebooks.labelPlaceholder', 'Описание')}
                      />
                      <HStack gap="4" align="center" className="shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDialto(i)}
                          className={`h-7 px-1.5 text-xs ${hasDialto ? 'text-primary' : 'text-muted-foreground'}`}
                          title={t('phonebooks.dialtoToggle', 'Перенаправление')}
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntry(i)}
                          className={cls.removeEntryBtn}
                        >
                          <Trash2 className={cls.removeEntryIcon} />
                        </Button>
                      </HStack>
                    </HStack>

                    {isOpen && (
                      <HStack gap="8" align="center" wrap="wrap" className="px-3 py-2 bg-muted/20">
                        <VStack gap="2" className="flex-1 min-w-[140px]">
                          <Text variant="muted" className="text-xs">{t('phonebooks.dialtoContext', 'Контекст')}</Text>
                          <Select
                            value={entry.dialto_context || ''}
                            onChange={(e) => updateEntry(i, 'dialto_context', e.target.value)}
                            className="text-sm"
                          >
                            <option value="">{t('phonebooks.selectContext', '— Контекст —')}</option>
                            {contexts.map(c => (
                              <option key={c.uid} value={c.name}>{c.name}{c.comment ? ` (${c.comment})` : ''}</option>
                            ))}
                          </Select>
                        </VStack>
                        <VStack gap="2" className="flex-1 min-w-[120px]">
                          <Text variant="muted" className="text-xs">{t('phonebooks.dialtoExten', 'Номер')}</Text>
                          <Input
                            value={entry.dialto_exten || ''}
                            onChange={(e) => updateEntry(i, 'dialto_exten', e.target.value)}
                            placeholder="101"
                            className="text-sm"
                          />
                        </VStack>
                      </HStack>
                    )}
                  </VStack>
                );
              })}

              {entries.length === 0 && (
                <Text variant="muted" className="py-4 text-center italic">
                  {t('phonebooks.noEntries', 'Нет номеров. Добавьте вручную или импортируйте из CSV.')}
                </Text>
              )}
            </VStack>
          )}

          {/* Tab: Actions */}
          {activeTab === 'actions' && (
            <VStack gap="12" className={cls.actionsSection}>
              <VStack gap="4">
                <Text variant="muted" className={cls.fieldLabel}>
                  {t('phonebooks.actionsLabel', 'Действия при совпадении')}
                </Text>
                <InfoTooltip text={t('phonebooks.actionsTooltip', 'Действия Asterisk dialplan, которые выполнятся при совпадении CallerID с номером из справочника. Вызов уходит в Gosub и возвращается через Return().')} />
              </VStack>
              <DialplanAppsEditor actions={actions} onChange={setActions} />
            </VStack>
          )}
        </VStack>

        <DialogFooter className="mt-6 pt-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            {isSaving
              ? t('common.saving', 'Сохранение...')
              : t('common.save', 'Сохранить')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

PhonebookFormModal.displayName = 'PhonebookFormModal';
