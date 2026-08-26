import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Text,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  MultiSelect,
  InfoTooltip,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useCreateNumberMutation, useUpdateNumberMutation } from '@/shared/api/api';
import { useGetUsersQuery } from '@/shared/api/endpoints/userApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetAllRoutesQuery } from '@/shared/api/endpoints/routeApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  getNumbersPageIsModalOpen,
  getNumbersPageSelectedNumber,
  getNumbersPageModalMode,
} from '../../model/selectors/numbersPageSelectors';
import { numbersPageActions } from '../../model/slice/numbersPageSlice';
import { extractExtension } from '@/features/endpoints/lib/endpointIds';
import { UserLevel } from '@/entities/User';
import styles from './NumberFormModal.module.scss';

export interface AccessListNumbers {
  operators: string[];
  queues: string[];
  routes: string[];
  cdrOperators: string[];
  cdrQueues: string[];
}

const EMPTY_NUMBERS: AccessListNumbers = {
  operators: [],
  queues: [],
  routes: [],
  cdrOperators: [],
  cdrQueues: [],
};

const TENANT_RAW_RE = /^(e(w)?.+_\d+|q.+_\d+)$/i;

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

function normalizeStoredToken(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const noSip = s.replace(/^(PJSIP|SIP)\//i, '');
  if (/^e(w)?.+_\d+$/i.test(noSip)) return extractExtension(noSip);
  const q = noSip.match(/^q(.+)_\d+$/i);
  if (q) return q[1];
  return noSip;
}

function asNormalized(v: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of asStrings(v)) {
    const n = normalizeStoredToken(item);
    if (!n || TENANT_RAW_RE.test(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function asIdStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const n = typeof item === 'number' ? item : (typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item.trim()) : NaN);
    if (!Number.isInteger(n) || n <= 0) continue;
    const s = String(n);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function parseCdrBlob(raw: unknown): { operators: string[]; queues: string[] } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { operators?: unknown; queues?: unknown; operatorUserIds?: unknown };
    if (Array.isArray(obj.operatorUserIds)) {
      return { operators: asIdStrings(obj.operatorUserIds), queues: asNormalized(obj.queues) };
    }
    return { operators: asNormalized(obj.operators), queues: asNormalized(obj.queues) };
  }
  return { operators: asNormalized(raw), queues: [] };
}

function parseNumbersBlob(value: unknown): AccessListNumbers & { operatorsAreUserIds: boolean; cdrOperatorsAreUserIds: boolean } {
  let raw: Record<string, unknown> = {};
  if (value == null || value === '') {
    return { ...EMPTY_NUMBERS, operatorsAreUserIds: true, cdrOperatorsAreUserIds: true };
  }
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { ...EMPTY_NUMBERS, operatorsAreUserIds: true, cdrOperatorsAreUserIds: true };
    }
  } else if (typeof value === 'object') {
    raw = value as Record<string, unknown>;
  }
  const cdr = parseCdrBlob(raw.cdr);
  const operatorsAreUserIds = Object.prototype.hasOwnProperty.call(raw, 'operatorUserIds');
  const cdrObj = raw.cdr && typeof raw.cdr === 'object' && !Array.isArray(raw.cdr)
    ? raw.cdr as { operatorUserIds?: unknown }
    : null;
  return {
    operators: operatorsAreUserIds ? asIdStrings(raw.operatorUserIds) : asNormalized(raw.operators),
    queues: asNormalized(raw.queues),
    routes: asStrings(raw.routes),
    cdrOperators: cdr.operators,
    cdrQueues: cdr.queues,
    operatorsAreUserIds,
    cdrOperatorsAreUserIds: Boolean(cdrObj && Array.isArray(cdrObj.operatorUserIds)),
  };
}

function queueToken(q: { name: string; exten?: string }): string {
  if (q.exten && String(q.exten).trim()) {
    return normalizeStoredToken(String(q.exten)) || String(q.exten).trim();
  }
  const m = q.name.match(/^q(.+)_\d+$/i);
  return m?.[1] || normalizeStoredToken(q.name) || q.name;
}

function humanName(raw: string | undefined, exten: string): string {
  let n = (raw || '').trim();
  if (!n) return '';
  // Drop trailing "(201)" if already formatted.
  const suffix = new RegExp(`\\s*\\(${exten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*$`);
  n = n.replace(suffix, '').trim();
  if (!n || n === exten || TENANT_RAW_RE.test(n) || /^(PJSIP|SIP)\//i.test(n)) return '';
  return n;
}

/** Always "Name (number)" when a human name exists; otherwise just the number. */
function userOperatorLabel(name: string | undefined, login: string | undefined, exten: string | undefined): string {
  const n = (name || login || '').trim();
  const ext = (exten || '').trim();
  if (n && ext && !TENANT_RAW_RE.test(ext) && n !== ext) return `${n} (${ext})`;
  return n || ext || '';
}

function mapExtensToUserIds(tokens: string[], users: Array<{ uniqueid: number; exten?: string; login?: string }>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const t = normalizeStoredToken(token);
    if (/^\d+$/.test(t) && users.some((u) => u.uniqueid === Number(t))) {
      if (!seen.has(t)) { seen.add(t); ids.push(t); }
      continue;
    }
    const u = users.find((usr) => {
      const ext = normalizeStoredToken((usr.exten || '').trim() || (/^\d+$/.test(usr.login || '') ? usr.login! : ''));
      return ext && ext === t;
    });
    if (u) {
      const id = String(u.uniqueid);
      if (!seen.has(id)) { seen.add(id); ids.push(id); }
    }
  }
  return ids;
}

function queueLabel(q: { name: string; exten?: string; display_name?: string }): string {
  const num = queueToken(q);
  // Prefer display_name; fall back to name only when it is not a tenant raw id.
  const title = humanName(q.display_name, num) || humanName(q.name, num);
  if (!title) return num || q.name;
  return `${title} (${num})`;
}

function normalizeRouteExt(ext: string): string {
  const s = ext.trim();
  if (/^e(w)?.+_\d+$/i.test(s)) return extractExtension(s);
  const q = s.match(/^q(.+)_\d+$/i);
  return q?.[1] || s;
}

export const NumberFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(getNumbersPageIsModalOpen);
  const selected = useAppSelector(getNumbersPageSelectedNumber);
  const modalMode = useAppSelector(getNumbersPageModalMode);
  const isEditing = modalMode === 'edit' && !!selected;

  const onClose = () => dispatch(numbersPageActions.closeModal());

  const [createNumber, { isLoading: isCreating }] = useCreateNumberMutation();
  const [updateNumber, { isLoading: isUpdating }] = useUpdateNumberMutation();
  const isLoading = isCreating || isUpdating;

  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !isOpen });
  const { data: queues = [] } = useGetQueuesQuery(undefined, { skip: !isOpen });
  const { data: routes = [] } = useGetAllRoutesQuery(undefined, { skip: !isOpen });

  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [numbers, setNumbers] = useState<AccessListNumbers>({ ...EMPTY_NUMBERS });
  const [tab, setTab] = useState('operators');
  const [operatorsAreUserIds, setOperatorsAreUserIds] = useState(true);
  const [cdrOperatorsAreUserIds, setCdrOperatorsAreUserIds] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && selected) {
      setName(selected.name || '');
      setComment(selected.comment || selected.description || '');
      const parsed = parseNumbersBlob((selected as { numbers?: unknown }).numbers);
      setNumbers({
        operators: parsed.operators,
        queues: parsed.queues,
        routes: parsed.routes,
        cdrOperators: parsed.cdrOperators,
        cdrQueues: parsed.cdrQueues,
      });
      setOperatorsAreUserIds(parsed.operatorsAreUserIds);
      setCdrOperatorsAreUserIds(parsed.cdrOperatorsAreUserIds);
    } else {
      setName('');
      setComment('');
      setNumbers({ ...EMPTY_NUMBERS });
      setOperatorsAreUserIds(true);
      setCdrOperatorsAreUserIds(true);
    }
    setTab('operators');
  }, [isOpen, isEditing, selected]);

  useEffect(() => {
    if (!isOpen || users.length === 0) return;
    if (!operatorsAreUserIds) {
      setNumbers((prev) => ({ ...prev, operators: mapExtensToUserIds(prev.operators, users) }));
      setOperatorsAreUserIds(true);
    }
    if (!cdrOperatorsAreUserIds) {
      setNumbers((prev) => ({ ...prev, cdrOperators: mapExtensToUserIds(prev.cdrOperators, users) }));
      setCdrOperatorsAreUserIds(true);
    }
  }, [isOpen, users, operatorsAreUserIds, cdrOperatorsAreUserIds]);

  const operatorOptions = useMemo(() => {
    const staff = users.filter((u) => u.level === UserLevel.OPERATOR || u.level === UserLevel.SUPERVISOR);
    const opts = staff.map((u) => {
      const exten = normalizeStoredToken(
        (u.exten || '').trim() || (/^\d+$/.test(u.login || '') ? u.login : ''),
      );
      return {
        value: String(u.uniqueid),
        label: userOperatorLabel(u.name, u.login, exten) || String(u.uniqueid),
      };
    });
    for (const id of [...numbers.operators, ...numbers.cdrOperators]) {
      if (!opts.some((o) => o.value === id)) {
        const u = users.find((usr) => String(usr.uniqueid) === id);
        opts.push({
          value: id,
          label: u ? userOperatorLabel(u.name, u.login, u.exten) : id,
        });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [users, numbers.operators, numbers.cdrOperators]);

  const queueOptions = useMemo(() => {
    const opts = queues.map((q) => ({
      value: queueToken(q),
      label: queueLabel(q),
    }));
    for (const token of [...numbers.queues, ...numbers.cdrQueues]) {
      const n = normalizeStoredToken(token);
      if (!n || TENANT_RAW_RE.test(n) || opts.some((o) => o.value === n)) continue;
      opts.push({ value: n, label: n });
    }
    return opts.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  }, [queues, numbers.queues, numbers.cdrQueues]);

  const routeOptions = useMemo(() => {
    const opts = routes.map((r) => {
      const exts = (r.extensions || [])
        .map(normalizeRouteExt)
        .filter((e) => e && !TENANT_RAW_RE.test(e));
      const title = (r.name || '').trim();
      const label = title && !TENANT_RAW_RE.test(title) ? title : (exts[0] || `#${r.uid}`);
      return {
        value: String(r.uid),
        label: exts.length && !label.includes(exts[0]) ? `${label} (${exts.join(', ')})` : label,
      };
    });
    for (const token of numbers.routes) {
      if (!opts.some((o) => o.value === token)) {
        opts.push({ value: token, label: token });
      }
    }
    return opts;
  }, [routes, numbers.routes]);

  const patchNumbers = (patch: Partial<AccessListNumbers>) => {
    setNumbers((prev) => ({ ...prev, ...patch }));
  };

  const searchPh = t('numbers.searchPlaceholder', 'Начните вводить…');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      comment: comment.trim() || undefined,
      numbers: {
        operatorUserIds: numbers.operators.map((id) => Number(id)).filter((n) => n > 0),
        operators: numbers.operators.map((id) => Number(id)).filter((n) => n > 0),
        queues: numbers.queues,
        routes: numbers.routes,
        cdr: {
          operatorUserIds: numbers.cdrOperators.map((id) => Number(id)).filter((n) => n > 0),
          queues: numbers.cdrQueues,
        },
      },
    };

    try {
      if (isEditing && selected) {
        await updateNumber({ id: selected.id, data: payload }).unwrap();
      } else {
        await createNumber(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save number list:', err);
    }
  };

  const selectProps = {
    searchable: true as const,
    searchPlaceholder: searchPh,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`flex flex-col gap-0 overflow-hidden max-h-[min(90vh,90dvh)] ${styles.dialogContent}`}
      >
        <DialogHeader className={`shrink-0 ${styles.header}`}>
          <DialogTitle>
            {isEditing ? t('numbers.edit') : t('numbers.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
          <div className={styles.formBody}>
            <VStack gap="16" max>
              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="numbers-name" className={styles.fieldLabel}>
                  {t('numbers.name')} *
                </Label>
                <Input
                  id="numbers-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </VStack>

              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="numbers-comment" className={styles.fieldLabel}>
                  {t('numbers.comment')}
                </Label>
                <Input
                  id="numbers-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </VStack>

              <VStack gap="12" max className={styles.scopeGroup}>
                <HStack gap="4" align="center" className={styles.scopeTitleRow}>
                  <Text className={styles.scopeTitle}>
                    {t('numbers.scopeTitle', 'Что видно в списке')}
                  </Text>
                  <InfoTooltip
                    text={t(
                      'numbers.scopeHint',
                      'Пустая вкладка = без ограничений. Операторы - пользователи (номер появится на старте смены).',
                    )}
                  />
                </HStack>

                <Tabs value={tab} onValueChange={setTab}>
                  <VStack className={styles.tabsWrap} max>
                    <TabsList className={styles.tabsList}>
                      <TabsTrigger value="operators" className={styles.tab}>
                        {t('numbers.tabOperators', 'Операторы')}
                        {numbers.operators.length > 0 ? ` (${numbers.operators.length})` : ''}
                      </TabsTrigger>
                      <TabsTrigger value="queues" className={styles.tab}>
                        {t('numbers.tabQueues', 'Очереди')}
                        {numbers.queues.length > 0 ? ` (${numbers.queues.length})` : ''}
                      </TabsTrigger>
                      <TabsTrigger value="routes" className={styles.tab}>
                        {t('numbers.tabRoutes', 'Маршруты')}
                        {numbers.routes.length > 0 ? ` (${numbers.routes.length})` : ''}
                      </TabsTrigger>
                      <TabsTrigger value="cdr" className={styles.tab}>
                        {t('numbers.tabCdr', 'CDR')}
                        {(numbers.cdrOperators.length + numbers.cdrQueues.length) > 0
                          ? ` (${numbers.cdrOperators.length + numbers.cdrQueues.length})`
                          : ''}
                      </TabsTrigger>
                    </TabsList>
                  </VStack>

                  <TabsContent value="operators" className={styles.tabPanel}>
                    <MultiSelect
                      {...selectProps}
                      value={numbers.operators}
                      onChange={(operators) => patchNumbers({ operators })}
                      options={operatorOptions}
                      placeholder={t('numbers.pickOperators', 'Выберите пользователей…')}
                    />
                  </TabsContent>

                  <TabsContent value="queues" className={styles.tabPanel}>
                    <MultiSelect
                      {...selectProps}
                      value={numbers.queues}
                      onChange={(queuesSel) => patchNumbers({ queues: queuesSel })}
                      options={queueOptions}
                      placeholder={t('numbers.pickQueues', 'Выберите очереди…')}
                    />
                  </TabsContent>

                  <TabsContent value="routes" className={styles.tabPanel}>
                    <MultiSelect
                      {...selectProps}
                      value={numbers.routes}
                      onChange={(routesSel) => patchNumbers({ routes: routesSel })}
                      options={routeOptions}
                      placeholder={t('numbers.pickRoutes', 'Выберите маршруты…')}
                    />
                  </TabsContent>

                  <TabsContent value="cdr" className={styles.tabPanel}>
                    <VStack gap="12" max>
                      <HStack gap="4" align="center">
                        <Text className={styles.subFieldLabel}>
                          {t('numbers.cdrOperators', 'Операторы в CDR')}
                        </Text>
                        <InfoTooltip
                          text={t(
                            'numbers.cdrHint',
                            'Пусто = все звонки тенанта. Если выбрать операторов и/или очереди - в журнале видны их звонки (по текущему/сменному номеру) и ваши собственные.',
                          )}
                        />
                      </HStack>
                      <MultiSelect
                        {...selectProps}
                        value={numbers.cdrOperators}
                        onChange={(cdrOperators) => patchNumbers({ cdrOperators })}
                        options={operatorOptions}
                        placeholder={t('numbers.pickOperators', 'Выберите пользователей…')}
                      />
                      <Text className={styles.subFieldLabel}>
                        {t('numbers.cdrQueues', 'Очереди в CDR')}
                      </Text>
                      <MultiSelect
                        {...selectProps}
                        value={numbers.cdrQueues}
                        onChange={(cdrQueues) => patchNumbers({ cdrQueues })}
                        options={queueOptions}
                        placeholder={t('numbers.pickQueues', 'Выберите очереди…')}
                      />
                    </VStack>
                  </TabsContent>
                </Tabs>
              </VStack>
            </VStack>
          </div>

          <DialogFooter className={styles.footer}>
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading && <Loader2 className={styles.iconSpin} />}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
