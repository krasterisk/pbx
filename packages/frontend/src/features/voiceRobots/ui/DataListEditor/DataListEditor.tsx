import { memo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Input, Label, Checkbox } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import {
  Plus, Pencil, Trash2, Database, Search, Table2, X, Upload,
} from 'lucide-react';
import { IVoiceRobotDataList, IDataListColumn } from '@/entities/voiceRobot';
import {
  useGetVoiceRobotDataListsQuery,
  useCreateVoiceRobotDataListMutation,
  useUpdateVoiceRobotDataListMutation,
  useDeleteVoiceRobotDataListMutation,
  useTestDataListSearchMutation,
} from '@/shared/api/endpoints/voiceRobotDataListsApi';
import cls from './DataListEditor.module.scss';

/**
 * Reads a File as text with automatic encoding detection.
 * Tries UTF-8 first; if it contains replacement chars or fails, falls back to windows-1251.
 */
function readFileAutoEncoding(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let text: string;

      // Try UTF-8 with fatal flag (throws on invalid bytes)
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        // Fallback to Windows-1251 (common for Russian CSV from Excel)
        text = new TextDecoder('windows-1251').decode(buffer);
      }

      // Strip BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }

      resolve(text);
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses a CSV string into columns and rows.
 * Auto-detects delimiter (semicolon or comma) based on first line.
 * Handles quoted fields with embedded newlines, commas, and escaped quotes (RFC 4180).
 */
function parseCsv(text: string): { columns: IDataListColumn[]; rows: Record<string, string>[] } {
  // Normalize line endings
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!input.trim()) return { columns: [], rows: [] };

  // --- Step 1: Split into logical records (respecting quoted newlines) ---
  const records: string[][] = [];
  let field = '';
  let inQuotes = false;
  let currentRecord: string[] = [];
  let delimiter: string | null = null; // auto-detect on first line

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // Escaped quote ""
          field += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Any char inside quotes (including \n) is part of the field
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (delimiter && ch === delimiter) {
        currentRecord.push(field.trim());
        field = '';
      } else if (!delimiter && (ch === ';' || ch === ',')) {
        // First delimiter encountered — auto-detect
        // Look at the rest of the first line to confirm
        const firstNewline = input.indexOf('\n');
        const headerPart = firstNewline > 0 ? input.substring(0, firstNewline) : input;
        const semicolons = (headerPart.match(/;/g) || []).length;
        const commas = (headerPart.match(/,/g) || []).length;
        delimiter = semicolons >= commas ? ';' : ',';
        // Now process current char with detected delimiter
        if (ch === delimiter) {
          currentRecord.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      } else if (ch === '\n') {
        // End of record
        currentRecord.push(field.trim());
        field = '';
        // Skip empty records (blank lines)
        if (currentRecord.some(f => f !== '')) {
          records.push(currentRecord);
        }
        currentRecord = [];
      } else {
        field += ch;
      }
    }
  }

  // Flush last record
  currentRecord.push(field.trim());
  if (currentRecord.some(f => f !== '')) {
    records.push(currentRecord);
  }

  if (records.length === 0) return { columns: [], rows: [] };

  // If delimiter was never detected (single-column CSV), set it
  if (!delimiter) delimiter = ';';

  // --- Step 2: Build columns from header row ---
  const headers = records[0];
  const columns: IDataListColumn[] = headers.map((label) => ({
    key: label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '') || 'col',
    label: label.trim(),
    searchable: true,
  }));

  // Ensure unique keys
  const keyCount: Record<string, number> = {};
  columns.forEach((col) => {
    if (keyCount[col.key]) {
      keyCount[col.key]++;
      col.key = `${col.key}_${keyCount[col.key]}`;
    } else {
      keyCount[col.key] = 1;
    }
  });

  // --- Step 3: Build data rows ---
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col.key] = values[idx] || '';
    });
    rows.push(row);
  }

  return { columns, rows };
}

export interface DataListEditorProps {
  robotId: number;
}

/** Default empty column template */
const newColumn = (): IDataListColumn => ({
  key: '',
  label: '',
  searchable: true,
});

export const DataListEditor = memo(({ robotId }: DataListEditorProps) => {
  const { t } = useTranslation();
  const { data: lists = [], isLoading } = useGetVoiceRobotDataListsQuery(robotId);
  const [createList] = useCreateVoiceRobotDataListMutation();
  const [updateList] = useUpdateVoiceRobotDataListMutation();
  const [deleteList] = useDeleteVoiceRobotDataListMutation();
  const [testSearch, { data: testResult, isLoading: isTesting }] = useTestDataListSearchMutation();

  // ─── CSV Import ───
  const csvInputRef = useRef<HTMLInputElement>(null);
  const csvAppendRef = useRef<HTMLInputElement>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [appendTargetId, setAppendTargetId] = useState<number | null>(null);

  // ─── Delete Confirmation ───
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Dialog State ───
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<IVoiceRobotDataList | null>(null);

  // ─── Form State ───
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColumns, setFormColumns] = useState<IDataListColumn[]>([newColumn()]);
  const [formRows, setFormRows] = useState<Record<string, string>[]>([]);

  // ─── Test Search ───
  const [testQuery, setTestQuery] = useState('');
  const [testField, setTestField] = useState('');
  const [testListId, setTestListId] = useState<number | null>(null);

  // ─── Handlers ───

  const openCreate = useCallback(() => {
    setEditingList(null);
    setFormName('');
    setFormDescription('');
    setFormColumns([newColumn()]);
    setFormRows([]);
    setDialogOpen(true);
  }, []);

  const handleCsvImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAutoEncoding(file);
      const { columns, rows } = parseCsv(text);

      if (columns.length === 0) {
        setCsvError(t('voiceRobots.dataLists.csvEmpty', 'Файл пуст или не содержит заголовков'));
        e.target.value = '';
        return;
      }

      // Extract name from filename (without extension)
      const fileName = file.name.replace(/\.[^.]+$/, '');

      setEditingList(null);
      setFormName(fileName);
      setFormDescription(t('voiceRobots.dataLists.csvImported', 'Импорт из {{file}}', { file: file.name }));
      setFormColumns(columns);
      setFormRows(rows);
      setDialogOpen(true);
    } catch {
      setCsvError(t('voiceRobots.dataLists.csvParseError', 'Ошибка чтения CSV файла'));
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [t]);

  /** Append CSV rows to an existing list */
  const handleCsvAppend = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    const file = e.target.files?.[0];
    if (!file || appendTargetId == null) return;

    const targetList = lists.find(l => l.uid === appendTargetId);
    if (!targetList) return;

    try {
      const text = await readFileAutoEncoding(file);
      const { columns: csvColumns, rows: csvRows } = parseCsv(text);

      if (csvColumns.length === 0 || csvRows.length === 0) {
        setCsvError(t('voiceRobots.dataLists.csvEmpty', 'Файл пуст или не содержит заголовков'));
        e.target.value = '';
        return;
      }

      const existingColumns = targetList.columns || [];

      // Build mapping: CSV column index → existing column key
      // Match by key first, then by label (case-insensitive), then by position
      const colMapping: Record<string, string> = {};
      csvColumns.forEach((csvCol, idx) => {
        const byKey = existingColumns.find(ec => ec.key === csvCol.key);
        if (byKey) { colMapping[csvCol.key] = byKey.key; return; }

        const byLabel = existingColumns.find(
          ec => ec.label.toLowerCase().trim() === csvCol.label.toLowerCase().trim()
        );
        if (byLabel) { colMapping[csvCol.key] = byLabel.key; return; }

        if (idx < existingColumns.length) {
          colMapping[csvCol.key] = existingColumns[idx].key;
        }
      });

      // Remap CSV rows to existing column keys
      const mappedRows = csvRows.map(csvRow => {
        const row: Record<string, string> = {};
        Object.entries(csvRow).forEach(([csvKey, value]) => {
          const targetKey = colMapping[csvKey];
          if (targetKey) row[targetKey] = value;
        });
        return row;
      });

      // Open edit dialog with existing + appended rows
      const existingRows = targetList.rows?.map(r => ({ ...r })) || [];
      setEditingList(targetList);
      setFormName(targetList.name);
      setFormDescription(targetList.description || '');
      setFormColumns(existingColumns.length ? [...existingColumns] : [newColumn()]);
      setFormRows([...existingRows, ...mappedRows]);
      setDialogOpen(true);
    } catch {
      setCsvError(t('voiceRobots.dataLists.csvParseError', 'Ошибка чтения CSV файла'));
    }
    e.target.value = '';
  }, [appendTargetId, lists, t]);

  const openEdit = useCallback((list: IVoiceRobotDataList) => {
    setEditingList(list);
    setFormName(list.name);
    setFormDescription(list.description || '');
    setFormColumns(list.columns?.length ? [...list.columns] : [newColumn()]);
    setFormRows(list.rows?.length ? list.rows.map(r => ({ ...r })) : []);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    // Auto-generate keys from labels if empty
    const columns = formColumns
      .filter(c => c.label.trim())
      .map((c, i) => ({
        ...c,
        key: c.key.trim() || c.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '') || `col_${i}`,
      }));

    const data = {
      name: formName,
      description: formDescription || null,
      columns,
      rows: formRows,
    };

    try {
      if (editingList) {
        await updateList({ id: editingList.uid, data }).unwrap();
      } else {
        await createList({ robotId, data }).unwrap();
      }
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save data list:', err);
    }
  }, [editingList, formName, formDescription, formColumns, formRows, robotId, createList, updateList]);

  const handleDelete = useCallback(async (uid: number) => {
    setIsDeleting(true);
    try {
      await deleteList(uid).unwrap();
    } catch (err) {
      console.error('Failed to delete data list:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  }, [deleteList]);

  // ─── Column Editing ───

  /** Compute the effective key for a column (same logic as resolvedColumns) */
  const resolveColKey = (col: IDataListColumn, index: number) =>
    col.key.trim() || col.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '') || `col_${index}`;

  const updateColumn = (index: number, field: keyof IDataListColumn, value: string | boolean) => {
    const oldCol = formColumns[index];
    const oldKey = resolveColKey(oldCol, index);
    const updatedCol = { ...oldCol, [field]: value };
    const newKey = resolveColKey(updatedCol, index);

    setFormColumns(prev => prev.map((c, i) => i === index ? updatedCol : c));

    // Remap row data if the resolved key changed
    if (oldKey !== newKey && (field === 'key' || field === 'label')) {
      setFormRows(prev => prev.map(row => {
        const newRow: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => {
          newRow[k === oldKey ? newKey : k] = v;
        });
        return newRow;
      }));
    }
  };

  const addColumn = () => {
    setFormColumns(prev => [...prev, newColumn()]);
  };

  const removeColumn = (index: number) => {
    const removedKey = resolveColKey(formColumns[index], index);
    setFormColumns(prev => prev.filter((_, i) => i !== index));
    if (removedKey) {
      setFormRows(prev => prev.map(row => {
        const newRow = { ...row };
        delete newRow[removedKey];
        return newRow;
      }));
    }
  };

  // ─── Row Editing ───

  const addRow = () => {
    const emptyRow: Record<string, string> = {};
    formColumns.forEach(c => {
      if (c.key || c.label) emptyRow[c.key || c.label.toLowerCase().replace(/\s+/g, '_')] = '';
    });
    setFormRows(prev => [...prev, emptyRow]);
  };

  const updateRowCell = (rowIndex: number, colKey: string, value: string) => {
    setFormRows(prev => prev.map((row, i) =>
      i === rowIndex ? { ...row, [colKey]: value } : row,
    ));
  };

  const removeRow = (index: number) => {
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Test Search ───

  const handleTestSearch = useCallback(async () => {
    if (!testListId || !testQuery.trim() || !testField.trim()) return;
    await testSearch({ listId: testListId, query: testQuery, returnField: testField });
  }, [testListId, testQuery, testField, testSearch]);

  // Resolve column keys for current form state
  const resolvedColumns = formColumns
    .filter(c => c.label.trim())
    .map((c, i) => ({
      ...c,
      key: c.key.trim() || c.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '') || `col_${i}`,
    }));

  return (
    <VStack className={cls.dataListEditor} max>
      {/* Header */}
      <HStack className={cls.header} max>
        <VStack gap="4">
          <Text variant="h3">{t('voiceRobots.dataLists.title', 'Справочники данных')}</Text>
          <Text variant="muted">{t('voiceRobots.dataLists.subtitle', 'Структурированные списки для поиска во время диалога')}</Text>
        </VStack>
        <HStack gap="8">
          <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            {t('voiceRobots.dataLists.importCsv', 'Импорт CSV')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('voiceRobots.dataLists.add', 'Добавить справочник')}
          </Button>
        </HStack>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleCsvImport}
        />
        <input
          ref={csvAppendRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleCsvAppend}
        />
      </HStack>

      {/* CSV Error */}
      {csvError && (
        <HStack className={cls.csvError}>
          <Text className="text-destructive text-sm">{csvError}</Text>
          <Button variant="ghost" size="icon" onClick={() => setCsvError(null)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </HStack>
      )}

      {/* List of Data Lists */}
      {isLoading ? (
        <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
      ) : lists.length === 0 ? (
        <VStack className={cls.emptyState}>
          <Database className="w-10 h-10 text-muted-foreground/50" />
          <Text variant="muted">{t('voiceRobots.dataLists.empty', 'Нет справочников. Создайте первый!')}</Text>
        </VStack>
      ) : (
        lists.map((list) => (
          <div key={list.uid} className={cls.listCard}>
            <HStack className={cls.listCardHeader}>
              <VStack className={cls.listMeta}>
                <Text variant="h4">{list.name}</Text>
                {list.description && <Text variant="muted">{list.description}</Text>}
                <HStack gap="12" className={cls.badge}>
                  <HStack gap="4">
                    <Table2 className="w-3.5 h-3.5" />
                    <Text variant="muted">
                      {t('voiceRobots.dataLists.rowCount', '{{count}} записей', { count: list.rows?.length || 0 })}
                    </Text>
                  </HStack>
                </HStack>
              </VStack>
              <HStack className={cls.listActions}>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('voiceRobots.dataLists.appendCsv', 'Добавить строки из CSV')}
                  onClick={() => {
                    setAppendTargetId(list.uid);
                    setTimeout(() => csvAppendRef.current?.click(), 0);
                  }}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = testListId === list.uid ? null : list.uid;
                    setTestListId(next);
                    if (next) {
                      setTestField(list.columns?.find(c => !c.searchable)?.key || list.columns?.[0]?.key || '');
                      // Scroll test panel into view after render
                      setTimeout(() => {
                        document.getElementById(`test-panel-${list.uid}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }, 50);
                    }
                  }}
                  className={testListId === list.uid ? 'bg-primary/10 text-primary' : ''}
                >
                  <Search className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(list)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(list.uid)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </HStack>
            </HStack>

            {/* Column chips */}
            {list.columns && (
              <HStack className={cls.columnsBar}>
                {list.columns.map((col) => (
                  <Text
                    key={col.key}
                    className={`${cls.columnChip} ${col.searchable ? cls.searchable : ''}`}
                  >
                    {col.searchable && <Search className="w-3 h-3" />}
                    {col.label}
                  </Text>
                ))}
              </HStack>
            )}

            {/* Inline test search */}
            {testListId === list.uid && (
              <VStack className={cls.testSection} id={`test-panel-${list.uid}`}>
                <Text variant="h4">{t('voiceRobots.dataLists.testSearch', 'Тест поиска')}</Text>
                <HStack className={cls.testRow}>
                  <VStack>
                    <Label>{t('voiceRobots.dataLists.testQuery', 'Запрос')}</Label>
                    <Input
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder={t('voiceRobots.dataLists.testQueryPlaceholder', 'Введите текст для поиска...')}
                    />
                  </VStack>
                  <VStack>
                    <Label>{t('voiceRobots.dataLists.returnField', 'Поле результата')}</Label>
                    <Input
                      value={testField}
                      onChange={(e) => setTestField(e.target.value)}
                      placeholder="phone"
                    />
                  </VStack>
                  <Button onClick={handleTestSearch} disabled={isTesting}>
                    <Search className="w-4 h-4 mr-1" />
                    {t('voiceRobots.dataLists.search', 'Найти')}
                  </Button>
                </HStack>
                {testResult && (
                  <VStack className={`${cls.testResult} ${testResult.result ? cls.found : cls.notFound}`}>
                    {testResult.result ? (
                      <>
                        <Text>{t('voiceRobots.dataLists.found', 'Найдено')}: <strong>{testResult.result.value}</strong></Text>
                        <Text variant="muted">
                          {t('voiceRobots.dataLists.confidence', 'Уверенность')}: {(testResult.result.confidence * 100).toFixed(1)}%
                          {' · '}{testResult.result.method}
                          {' · '}{testResult.elapsed_ms}{t('voiceRobots.dataLists.ms', 'мс')}
                        </Text>
                      </>
                    ) : (
                      <Text>{t('voiceRobots.dataLists.notFound', 'Совпадений не найдено')} ({testResult.elapsed_ms}{t('voiceRobots.dataLists.ms', 'мс')})</Text>
                    )}
                  </VStack>
                )}
              </VStack>
            )}
          </div>
        ))
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('voiceRobots.dataLists.deleteTitle', 'Удалить справочник?')}</DialogTitle>
          </DialogHeader>
          <Text variant="muted">
            {t('voiceRobots.dataLists.deleteConfirm', 'Справочник и все его данные будут удалены без возможности восстановления.')}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete', 'Удалить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingList
                ? t('voiceRobots.dataLists.edit', 'Редактировать справочник')
                : t('voiceRobots.dataLists.create', 'Новый справочник')}
            </DialogTitle>
          </DialogHeader>

          <VStack className={cls.formFields}>
            {/* Name */}
            <VStack gap="4">
              <Label>{t('voiceRobots.dataLists.name', 'Название')}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t('voiceRobots.dataLists.namePlaceholder', 'Менеджеры, Районы...')} />
            </VStack>

            {/* Description */}
            <VStack gap="4">
              <Label>{t('voiceRobots.dataLists.description', 'Описание')}</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={t('voiceRobots.dataLists.descriptionPlaceholder', 'Необязательно')} />
            </VStack>

            {/* Columns */}
            <VStack className={cls.columnsSection}>
              <HStack justify="between" max>
                <Label>{t('voiceRobots.dataLists.columns', 'Колонки')}</Label>
                <Button variant="ghost" size="sm" onClick={addColumn}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t('voiceRobots.dataLists.addColumn', 'Колонка')}
                </Button>
              </HStack>

              {formColumns.map((col, idx) => (
                <HStack key={idx} className={cls.columnRow}>
                  <Input
                    value={col.label}
                    onChange={(e) => updateColumn(idx, 'label', e.target.value)}
                    placeholder={t('voiceRobots.dataLists.columnLabel', 'Название')}
                  />
                  <Input
                    value={col.key}
                    onChange={(e) => updateColumn(idx, 'key', e.target.value)}
                    placeholder={t('voiceRobots.dataLists.columnKey', 'Ключ (авто)')}
                  />
                  <HStack gap="4" align="center">
                    <Checkbox
                      checked={col.searchable}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(idx, 'searchable', e.target.checked)}
                    />
                    <Text variant="muted" className="text-xs whitespace-nowrap">
                      {t('voiceRobots.dataLists.searchable', 'Поиск')}
                    </Text>
                  </HStack>
                  <Button variant="ghost" size="icon" onClick={() => removeColumn(idx)} disabled={formColumns.length <= 1}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </HStack>
              ))}
            </VStack>

            {/* Data Rows */}
            <VStack className={cls.rowsSection}>
              <HStack justify="between" max>
                <Label>{t('voiceRobots.dataLists.rows', 'Данные')} ({formRows.length})</Label>
                <Button variant="ghost" size="sm" onClick={addRow} disabled={resolvedColumns.length === 0}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t('voiceRobots.dataLists.addRow', 'Строка')}
                </Button>
              </HStack>

              {resolvedColumns.length > 0 && formRows.length > 0 && (
                <VStack className={cls.tableWrapper}>
                  <table className={cls.dataTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        {resolvedColumns.map((col) => (
                          <th key={col.key}>
                            {col.label}
                            {col.searchable && <Search className="inline w-3 h-3 ml-1 opacity-50" />}
                          </th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {formRows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td>
                            <Text variant="muted" className="text-xs">{rowIdx + 1}</Text>
                          </td>
                          {resolvedColumns.map((col) => (
                            <td key={col.key}>
                              <input
                                value={row[col.key] || ''}
                                onChange={(e) => updateRowCell(rowIdx, col.key, e.target.value)}
                                placeholder="—"
                              />
                            </td>
                          ))}
                          <td>
                            <Button variant="ghost" size="icon" onClick={() => removeRow(rowIdx)}>
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </VStack>
              )}

              {resolvedColumns.length === 0 && (
                <Text variant="muted" className="text-center py-4">
                  {t('voiceRobots.dataLists.addColumnsFirst', 'Сначала добавьте колонки')}
                </Text>
              )}
            </VStack>
          </VStack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim() || resolvedColumns.length === 0}>
              {t('common.save', 'Сохранить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
});

DataListEditor.displayName = 'DataListEditor';
