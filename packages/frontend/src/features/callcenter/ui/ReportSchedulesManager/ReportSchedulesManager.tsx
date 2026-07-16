import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Input,
  Label,
  Text,
  Skeleton,
  Select,
  Switch,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import {
  CC_REPORT_IDS,
  useGetReportSchedulesQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useRunReportScheduleNowMutation,
  type CcReportId,
  type ReportSchedule,
  type ReportScheduleFrequency,
  type ReportSchedulePayload,
  type ReportSchedulePeriodPreset,
} from '@/shared/api/endpoints/callCenterReportsApi';
import styles from './ReportSchedulesManager.module.scss';

const PERIOD_PRESETS: ReportSchedulePeriodPreset[] = [
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'previous-month',
];

const FREQUENCIES: ReportScheduleFrequency[] = ['daily', 'weekly', 'monthly'];

const EMPTY_FORM: ReportSchedulePayload = {
  name: '',
  report_id: 'queue-summary',
  format: 'xlsx',
  period_preset: 'yesterday',
  filters: {},
  frequency: 'daily',
  hour: 8,
  minute: 0,
  day_of_week: 1,
  day_of_month: 1,
  integration_uid: 0,
  target: '',
  subject_template: '',
  message_template: '',
  enabled: true,
};

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Supervisor tab: CRUD + run-now for scheduled CC report delivery (D-35).
 * Format options are CSV/XLSX only — PDF is client-only on the reports page.
 */
export function ReportSchedulesManager() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const isSupervisor =
    level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const { data: schedules = [], isLoading, isError, refetch } = useGetReportSchedulesQuery(
    undefined,
    { skip: !isSupervisor },
  );
  const { data: integrations = [] } = useGetNotificationsQuery(undefined, {
    skip: !isSupervisor,
  });
  const [createSchedule, { isLoading: isCreating }] = useCreateReportScheduleMutation();
  const [updateSchedule, { isLoading: isUpdating }] = useUpdateReportScheduleMutation();
  const [deleteSchedule, { isLoading: isDeleting }] = useDeleteReportScheduleMutation();
  const [runNow, { isLoading: isRunning }] = useRunReportScheduleNowMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [form, setForm] = useState<ReportSchedulePayload>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ReportSchedule | null>(null);

  const integrationName = useMemo(() => {
    const map = new Map(integrations.map((i) => [i.uid, `${i.name} (${i.channel})`]));
    return (uid: number) => map.get(uid) ?? String(uid);
  }, [integrations]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      integration_uid: integrations[0]?.uid ?? 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: ReportSchedule) => {
    setEditing(row);
    setForm({
      name: row.name,
      report_id: row.report_id,
      format: row.format,
      period_preset: row.period_preset,
      filters: row.filters ?? {},
      frequency: row.frequency,
      hour: row.hour,
      minute: row.minute,
      day_of_week: row.day_of_week ?? 1,
      day_of_month: row.day_of_month ?? 1,
      integration_uid: row.integration_uid,
      target: row.target ?? '',
      subject_template: row.subject_template ?? '',
      message_template: row.message_template ?? '',
      enabled: row.enabled,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('callcenter.settings.reportSchedules.nameRequired'));
      return;
    }
    if (!form.integration_uid) {
      toast.error(t('callcenter.settings.reportSchedules.channelRequired'));
      return;
    }
    const payload: ReportSchedulePayload = {
      ...form,
      name: form.name.trim(),
      target: form.target?.trim() || null,
      subject_template: form.subject_template?.trim() || null,
      message_template: form.message_template?.trim() || null,
      filters: {
        queueName: form.filters?.queueName?.trim() || undefined,
        agentInterface: form.filters?.agentInterface?.trim() || undefined,
      },
      day_of_week: form.frequency === 'weekly' ? form.day_of_week ?? 1 : null,
      day_of_month: form.frequency === 'monthly' ? form.day_of_month ?? 1 : null,
    };
    try {
      if (editing) {
        await updateSchedule({ uid: editing.uid, ...payload }).unwrap();
        toast.success(t('callcenter.settings.reportSchedules.updated'));
      } else {
        await createSchedule(payload).unwrap();
        toast.success(t('callcenter.settings.reportSchedules.created'));
      }
      setDialogOpen(false);
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  const handleToggle = async (row: ReportSchedule, enabled: boolean) => {
    try {
      await updateSchedule({ uid: row.uid, enabled }).unwrap();
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  const handleRunNow = async (row: ReportSchedule) => {
    try {
      const res = await runNow(row.uid).unwrap();
      if (res.success) {
        toast.success(t('callcenter.settings.reportSchedules.runOk'));
      } else {
        toast.error(
          res.error
            ? t('callcenter.settings.reportSchedules.runFailDetail', { error: res.error })
            : t('callcenter.settings.reportSchedules.runFail'),
        );
      }
    } catch {
      toast.error(t('callcenter.settings.reportSchedules.runFail'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSchedule(deleteTarget.uid).unwrap();
      toast.success(t('callcenter.settings.reportSchedules.deleted'));
      setDeleteTarget(null);
    } catch {
      toast.error(t('common.error', 'Ошибка удаления'));
    }
  };

  const columns = useMemo<ColumnDef<ReportSchedule, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('callcenter.settings.reportSchedules.colName'),
      },
      {
        id: 'report',
        header: t('callcenter.settings.reportSchedules.colReport'),
        cell: ({ row }) => t(`callcenter.reports.ids.${row.original.report_id}`),
      },
      {
        accessorKey: 'format',
        header: t('callcenter.settings.reportSchedules.colFormat'),
        cell: ({ getValue }) => String(getValue()).toUpperCase(),
      },
      {
        id: 'schedule',
        header: t('callcenter.settings.reportSchedules.colSchedule'),
        cell: ({ row }) => {
          const s = row.original;
          const freq = t(`callcenter.settings.reportSchedules.freq.${s.frequency}`);
          const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
          return `${freq} ${time}`;
        },
      },
      {
        id: 'channel',
        header: t('callcenter.settings.reportSchedules.colChannel'),
        cell: ({ row }) => integrationName(row.original.integration_uid),
      },
      {
        id: 'enabled',
        header: t('callcenter.settings.reportSchedules.colEnabled'),
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            onCheckedChange={(v) => handleToggle(row.original, v)}
            aria-label={t('callcenter.settings.reportSchedules.colEnabled')}
          />
        ),
      },
      {
        id: 'next',
        header: t('callcenter.settings.reportSchedules.colNext'),
        cell: ({ row }) => formatDt(row.original.next_run_at),
      },
      {
        id: 'actions',
        header: t('callcenter.settings.reportSchedules.colActions'),
        cell: ({ row }) => (
          <div className={styles.actions}>
            <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row.original)}>
              {t('callcenter.settings.reportSchedules.edit')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isRunning}
              onClick={() => handleRunNow(row.original)}
            >
              {t('callcenter.settings.reportSchedules.runNow')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              {t('callcenter.settings.reportSchedules.delete')}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over stable RTK mutations
    [t, integrationName, isRunning],
  );

  if (!isSupervisor) {
    return (
      <div className={styles.denied}>
        <Text>{t('callcenter.settings.reportSchedules.denied')}</Text>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorCard}>
        <Text>{t('callcenter.settings.loadError')}</Text>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          {t('callcenter.settings.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <Text className={styles.title}>{t('callcenter.settings.reportSchedules.title')}</Text>
          <Text className={styles.hint}>{t('callcenter.settings.reportSchedules.hint')}</Text>
        </div>
        <Button type="button" onClick={openCreate}>
          {t('callcenter.settings.reportSchedules.add')}
        </Button>
      </div>

      {schedules.length === 0 ? (
        <div className={styles.empty}>
          <Text>{t('callcenter.settings.reportSchedules.empty')}</Text>
          <Button type="button" onClick={openCreate}>
            {t('callcenter.settings.reportSchedules.add')}
          </Button>
        </div>
      ) : (
        <DataTable
          data={schedules}
          columns={columns}
          getRowId={(r) => String(r.uid)}
          pageSize={20}
          emptyText={t('callcenter.settings.reportSchedules.empty')}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('callcenter.settings.reportSchedules.editTitle')
                : t('callcenter.settings.reportSchedules.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <Label htmlFor="rs-name">{t('callcenter.settings.reportSchedules.fieldName')}</Label>
              <Input
                id="rs-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-report">{t('callcenter.settings.reportSchedules.fieldReport')}</Label>
              <Select
                id="rs-report"
                value={form.report_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, report_id: e.target.value as CcReportId }))
                }
              >
                {CC_REPORT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`callcenter.reports.ids.${id}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-format">{t('callcenter.settings.reportSchedules.fieldFormat')}</Label>
              <Select
                id="rs-format"
                value={form.format}
                onChange={(e) =>
                  setForm((f) => ({ ...f, format: e.target.value as 'csv' | 'xlsx' }))
                }
              >
                <option value="xlsx">XLSX</option>
                <option value="csv">CSV</option>
              </Select>
              <span className={styles.formatHint}>
                {t('callcenter.settings.reportSchedules.formatHint')}
              </span>
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-period">{t('callcenter.settings.reportSchedules.fieldPeriod')}</Label>
              <Select
                id="rs-period"
                value={form.period_preset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    period_preset: e.target.value as ReportSchedulePeriodPreset,
                  }))
                }
              >
                {PERIOD_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {t(`callcenter.settings.reportSchedules.period.${p}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-freq">{t('callcenter.settings.reportSchedules.fieldFrequency')}</Label>
              <Select
                id="rs-freq"
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequency: e.target.value as ReportScheduleFrequency,
                  }))
                }
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`callcenter.settings.reportSchedules.freq.${f}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-hour">{t('callcenter.settings.reportSchedules.fieldHour')}</Label>
              <Input
                id="rs-hour"
                type="number"
                min={0}
                max={23}
                value={form.hour}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hour: Number(e.target.value) || 0 }))
                }
              />
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-minute">{t('callcenter.settings.reportSchedules.fieldMinute')}</Label>
              <Input
                id="rs-minute"
                type="number"
                min={0}
                max={59}
                value={form.minute}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minute: Number(e.target.value) || 0 }))
                }
              />
            </div>

            {form.frequency === 'weekly' && (
              <div className={styles.field}>
                <Label htmlFor="rs-dow">{t('callcenter.settings.reportSchedules.fieldDow')}</Label>
                <Select
                  id="rs-dow"
                  value={form.day_of_week ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))
                  }
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {t(`callcenter.settings.reportSchedules.dow.${d}`)}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {form.frequency === 'monthly' && (
              <div className={styles.field}>
                <Label htmlFor="rs-dom">{t('callcenter.settings.reportSchedules.fieldDom')}</Label>
                <Input
                  id="rs-dom"
                  type="number"
                  min={1}
                  max={28}
                  value={form.day_of_month ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, day_of_month: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            )}

            <div className={styles.field}>
              <Label htmlFor="rs-queue">{t('callcenter.settings.reportSchedules.fieldQueue')}</Label>
              <Input
                id="rs-queue"
                value={form.filters?.queueName ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    filters: { ...f.filters, queueName: e.target.value },
                  }))
                }
              />
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-agent">{t('callcenter.settings.reportSchedules.fieldAgent')}</Label>
              <Input
                id="rs-agent"
                value={form.filters?.agentInterface ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    filters: { ...f.filters, agentInterface: e.target.value },
                  }))
                }
              />
            </div>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              <Label htmlFor="rs-channel">{t('callcenter.settings.reportSchedules.fieldChannel')}</Label>
              <Select
                id="rs-channel"
                value={form.integration_uid || ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, integration_uid: Number(e.target.value) || 0 }))
                }
              >
                <option value="">{t('callcenter.settings.reportSchedules.channelPlaceholder')}</option>
                {integrations.map((i) => (
                  <option key={i.uid} value={i.uid}>
                    {i.name} ({i.channel})
                  </option>
                ))}
              </Select>
            </div>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              <Label htmlFor="rs-target">{t('callcenter.settings.reportSchedules.fieldTarget')}</Label>
              <Input
                id="rs-target"
                value={form.target ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              />
            </div>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              <Label htmlFor="rs-subject">{t('callcenter.settings.reportSchedules.fieldSubject')}</Label>
              <Input
                id="rs-subject"
                value={form.subject_template ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, subject_template: e.target.value }))}
                placeholder="{{report}} / {{period}}"
              />
            </div>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              <Label htmlFor="rs-message">{t('callcenter.settings.reportSchedules.fieldMessage')}</Label>
              <textarea
                id="rs-message"
                className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                value={form.message_template ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <Label htmlFor="rs-enabled">{t('callcenter.settings.reportSchedules.colEnabled')}</Label>
              <Switch
                id="rs-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              type="button"
              disabled={isCreating || isUpdating}
              onClick={handleSave}
            >
              {t('callcenter.settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('callcenter.settings.reportSchedules.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <Text>
            {t('callcenter.settings.reportSchedules.deleteConfirm', {
              name: deleteTarget?.name ?? '',
            })}
          </Text>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {t('callcenter.settings.reportSchedules.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
