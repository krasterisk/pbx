import { memo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button, Input, Text, Label, Checkbox, InfoTooltip, Tooltip } from '@/shared/ui';
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
  comment: string;
  vars: Record<string, string>;
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
      comment: e.comment || e.label || '',
      vars: e.vars || {},
    })) || [],
  );
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createPhonebook, { isLoading: isCreating }] = useCreatePhonebookMutation();
  const [updatePhonebook, { isLoading: isUpdating }] = useUpdatePhonebookMutation();
  const [importCsv] = useImportPhonebookCsvMutation();

  const handleClose = useCallback(() => {
    dispatch(phonebooksActions.closeModal());
  }, [dispatch]);

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, { number: '', comment: '', vars: {} }]);
  }, []);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setExpandedEntries(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const updateEntryField = useCallback((index: number, field: 'number' | 'comment', value: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }, []);

  // Vars management
  const addVar = useCallback((index: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e;
      // Generate unique key name
      let n = Object.keys(e.vars).length + 1;
      let newKey = `var_${n}`;
      while (newKey in e.vars) { n++; newKey = `var_${n}`; }
      return { ...e, vars: { ...e.vars, [newKey]: '' } };
    }));
  }, []);

  const updateVarKey = useCallback((entryIndex: number, oldKey: string, newKey: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIndex) return e;
      const vars = { ...e.vars };
      const value = vars[oldKey];
      delete vars[oldKey];
      vars[newKey] = value || '';
      return { ...e, vars };
    }));
  }, []);

  const updateVarValue = useCallback((entryIndex: number, key: string, value: string) => {
    setEntries(prev => prev.map((e, i) =>
      i === entryIndex ? { ...e, vars: { ...e.vars, [key]: value } } : e,
    ));
  }, []);

  const removeVar = useCallback((entryIndex: number, key: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIndex) return e;
      const vars = { ...e.vars };
      delete vars[key];
      return { ...e, vars };
    }));
  }, []);

  // CSV import — supports columnar and vertical formats
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
      if (lines.length < 2) return; // Need at least header + 1 row

      // Auto-detect delimiter
      const firstLine = lines[0];
      const semicolons = (firstLine.match(/;/g) || []).length;
      const commas = (firstLine.match(/,/g) || []).length;
      const delimiter = semicolons >= commas ? ';' : ',';

      // Parse header
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

      // Detect format
      const isVertical = headers.includes('var') && headers.includes('value');

      if (isVertical) {
        const numIdx = headers.indexOf('number');
        const varIdx = headers.indexOf('var');
        const valIdx = headers.indexOf('value');
        const grouped = new Map<string, PhonebookEntry>();

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
          const num = parts[numIdx];
          if (!num || num.length < 3) continue;

          if (!grouped.has(num)) {
            grouped.set(num, { number: num, comment: '', vars: {} });
          }
          const entry = grouped.get(num)!;
          const varKey = parts[varIdx];
          const varVal = parts[valIdx];
          if (varKey === 'comment') {
            entry.comment = varVal || '';
          } else if (varKey && varVal) {
            entry.vars[varKey] = varVal;
          }
        }

        setEntries(prev => [...prev, ...Array.from(grouped.values())]);
      } else {
        // Columnar format: column headers = var keys
        const numIdx = headers.findIndex(h => /^(number|номер|phone|телефон|#)$/i.test(h));
        if (numIdx === -1) return;
        const commentIdx = headers.indexOf('comment');
        const varColumns = headers
          .map((h, idx) => ({ header: h, index: idx }))
          .filter(c => c.index !== numIdx && c.index !== commentIdx && c.header);

        const newEntries: PhonebookEntry[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
          const num = parts[numIdx];
          if (!num || num.length < 3) continue;

          const vars: Record<string, string> = {};
          for (const col of varColumns) {
            const val = parts[col.index];
            if (val) vars[col.header] = val;
          }

          newEntries.push({
            number: num,
            comment: commentIdx >= 0 ? (parts[commentIdx] || '') : '',
            vars,
          });
        }

        setEntries(prev => [...prev, ...newEntries]);
      }
    };
    reader.readAsText(file, 'utf-8');
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
      entries: validEntries.map(e => {
        const cleanVars: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.vars)) {
          if (k.trim() && v.trim()) cleanVars[k.trim()] = v.trim();
        }
        return {
          number: e.number.trim(),
          comment: e.comment.trim(),
          vars: Object.keys(cleanVars).length > 0 ? cleanVars : undefined,
        };
      }),
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

  // Collect all unique var keys from all entries (for hint in actions tab)
  const allVarKeys = Array.from(new Set(entries.flatMap(e => Object.keys(e.vars)))).sort();

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

        <VStack className={cls.scrollBody}>
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
                  <Tooltip
                    content={
                      <div style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Колоночный формат:</div>
                        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(0,0,0,0.15)', padding: '6px 8px', borderRadius: 4 }}>
{`number;comment;name;clid
79001234567;Иванов;Иванов И.И.;84951110000
79002345678;Петров;Петров П.П.;84952220000`}
                        </pre>
                        <div style={{ marginTop: 6, color: 'hsl(var(--muted-foreground))' }}>
                          Заголовки = ключи переменных PB_*
                        </div>
                      </div>
                    }
                    side="bottom"
                    contentClassName="max-w-[400px]"
                  >
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className={cls.removeEntryIcon} />
                      {t('phonebooks.importCsv', 'Импорт CSV')}
                    </Button>
                  </Tooltip>
                  <Button variant="outline" size="sm" onClick={addEntry}>
                    <Plus className={cls.removeEntryIcon} />
                    {t('phonebooks.addEntry', 'Добавить номер')}
                  </Button>
                </HStack>
              </VStack>

              {/* Entries list header */}
              {entries.length > 0 && (
                <HStack className={cls.entryHeader}>
                  <Text variant="muted" className={cls.fieldLabel}>
                    {t('phonebooks.numberColumn', 'Номер')}
                  </Text>
                  <Text variant="muted" className={cls.fieldLabel}>
                    {t('phonebooks.commentColumn', 'Описание')}
                  </Text>
                  <VStack>{''}</VStack>
                </HStack>
              )}

              {/* Entries list */}
              {entries.map((entry, i) => {
                const hasVars = Object.keys(entry.vars).length > 0;
                const isOpen = expandedEntries.has(i);

                return (
                  <VStack key={i} gap="0" className="border border-border rounded-md bg-background overflow-hidden">
                    <HStack className={cls.entryRow} style={{ padding: '0.5rem', borderBottom: isOpen ? '1px solid hsl(var(--border) / 0.5)' : 'none' }}>
                      <Input
                        value={entry.number}
                        onChange={(e) => updateEntryField(i, 'number', e.target.value)}
                        placeholder="+79001234567"
                      />
                      <Input
                        value={entry.comment}
                        onChange={(e) => updateEntryField(i, 'comment', e.target.value)}
                        placeholder={t('phonebooks.commentPlaceholder', 'Комментарий')}
                      />
                      <HStack gap="4" align="center" className="shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(i)}
                          className={`h-7 px-1.5 text-xs ${hasVars ? 'text-primary' : 'text-muted-foreground'}`}
                          title={t('phonebooks.varsLabel', 'Переменные (PB_*)')}
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          {hasVars && <span className="ml-0.5 text-[10px]">{Object.keys(entry.vars).length}</span>}
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

                    {/* Vars editor */}
                    {isOpen && (
                      <VStack gap="6" className="px-3 py-2 bg-muted/20">
                        <HStack align="center" gap="4">
                          <Text variant="muted" className="text-xs font-medium">
                            {t('phonebooks.varsLabel', 'Переменные (PB_*)')}
                          </Text>
                          <InfoTooltip text={t('phonebooks.varsHint', 'Каждая переменная становится ${PB_<ключ>} в dialplan при совпадении CallerID.')} />
                        </HStack>

                        {Object.entries(entry.vars).map(([key, value], varIdx) => (
                          <HStack key={varIdx} gap="4" align="center">
                            <Input
                              value={key}
                              onChange={(e) => updateVarKey(i, key, e.target.value)}
                              placeholder={t('phonebooks.varsKeyPlaceholder', 'name')}
                              className="text-sm flex-1 max-w-[140px]"
                            />
                            <Text variant="muted" className="text-xs">=</Text>
                            <Input
                              value={value}
                              onChange={(e) => updateVarValue(i, key, e.target.value)}
                              placeholder={t('phonebooks.varsValuePlaceholder', 'Иванов И.И.')}
                              className="text-sm flex-1"
                            />
                            <Button variant="ghost" size="sm" onClick={() => removeVar(i, key)} className="h-7 px-1">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </HStack>
                        ))}

                        <Button variant="outline" size="sm" onClick={() => addVar(i)} className="self-start text-xs h-7">
                          <Plus className="w-3 h-3 mr-1" />
                          {t('phonebooks.addVar', 'Добавить переменную')}
                        </Button>
                      </VStack>
                    )}
                  </VStack>
                );
              })}

              {entries.length === 0 && (
                <Text variant="muted" className="py-4 text-center italic">
                  {t('phonebooks.noEntries', 'Нет номеров. Добавьте вручную или импортируйте из CSV.')}
                </Text>
              )}

              {/* Bottom add button — always visible */}
              <Button variant="outline" size="sm" onClick={addEntry} className="self-start">
                <Plus className={cls.removeEntryIcon} />
                {t('phonebooks.addEntry', 'Добавить номер')}
              </Button>
            </VStack>
          )}

          {/* Tab: Actions */}
          {activeTab === 'actions' && (
            <VStack gap="12" className={cls.actionsSection}>
              <VStack gap="4">
                <Text variant="muted" className={cls.fieldLabel}>
                  {t('phonebooks.actionsLabel', 'Действия при совпадении')}
                </Text>
                <InfoTooltip text={t('phonebooks.actionsTooltip', 'Произвольные действия dialplan при совпадении CallerID. В действиях доступны переменные ${PB_<ключ>} из записей справочника.')} />
              </VStack>

              {/* PB_* variable hint */}
              {allVarKeys.length > 0 && (
                <VStack className="px-3 py-2 bg-muted/20 rounded-md border border-border/50 text-xs">
                  <Text variant="muted" className="font-medium mb-1">
                    ℹ️ Доступные переменные записей:
                  </Text>
                  {allVarKeys.map((key) => (
                    <Text key={key} variant="muted" className="font-mono ml-2">
                      {'${'}PB_{key}{'}'} 
                    </Text>
                  ))}
                </VStack>
              )}

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
