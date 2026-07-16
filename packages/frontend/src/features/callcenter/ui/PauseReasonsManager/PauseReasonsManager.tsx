import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Text,
  Skeleton,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import type { IPauseReason } from '@/features/callcenter/model/types/callCenterSchema';
import {
  useGetPauseReasonsQuery,
  useCreatePauseReasonMutation,
  useUpdatePauseReasonMutation,
  useDeletePauseReasonMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './PauseReasonsManager.module.scss';

const DEFAULT_COLOR = '#f59e0b';

interface PauseReasonForm {
  name: string;
  color: string;
  max_duration: number;
  is_paid: boolean;
  sort_order: number;
}

const EMPTY_FORM: PauseReasonForm = {
  name: '',
  color: DEFAULT_COLOR,
  max_duration: 0,
  is_paid: false,
  sort_order: 0,
};

/**
 * Settings tab: CRUD for pause reasons catalog (D-40).
 */
export function PauseReasonsManager() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const isSupervisor = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const { data: reasons = [], isLoading, isError, refetch } = useGetPauseReasonsQuery(undefined, {
    skip: !isSupervisor,
  });
  const [createReason, { isLoading: isCreating }] = useCreatePauseReasonMutation();
  const [updateReason, { isLoading: isUpdating }] = useUpdatePauseReasonMutation();
  const [deleteReason, { isLoading: isDeleting }] = useDeletePauseReasonMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IPauseReason | null>(null);
  const [form, setForm] = useState<PauseReasonForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<IPauseReason | null>(null);

  const sorted = useMemo(
    () => [...reasons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [reasons],
  );

  if (!isSupervisor) {
    return (
      <div className={styles.denied}>
        <Text>{t('callcenter.settings.pauseReasons.denied', 'Недостаточно прав')}</Text>
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

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: sorted.length > 0 ? Math.max(...sorted.map((r) => r.sort_order ?? 0)) + 1 : 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: IPauseReason) => {
    setEditing(row);
    setForm({
      name: row.name,
      color: row.color || DEFAULT_COLOR,
      max_duration: row.max_duration ?? 0,
      is_paid: Boolean(row.is_paid),
      sort_order: row.sort_order ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t('callcenter.pauseReasons.name', 'Название'));
      return;
    }
    const payload: Partial<IPauseReason> = {
      name,
      color: form.color || DEFAULT_COLOR,
      max_duration: Number.isFinite(form.max_duration) && form.max_duration >= 0 ? form.max_duration : 0,
      is_paid: form.is_paid,
      sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
    };
    try {
      if (editing) {
        await updateReason({ id: editing.uid, data: payload }).unwrap();
      } else {
        await createReason(payload).unwrap();
      }
      setDialogOpen(false);
      toast.success(t('callcenter.settings.pauseReasons.saved', 'Причина сохранена'));
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReason(deleteTarget.uid).unwrap();
      setDeleteTarget(null);
      toast.success(t('callcenter.settings.pauseReasons.deleted', 'Причина удалена'));
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  const formatDuration = (mins: number) => {
    if (!mins || mins <= 0) {
      return t('callcenter.settings.pauseReasons.unlimited', 'Без лимита');
    }
    return `${mins} ${t('callcenter.settings.pauseReasons.minutes', 'мин')}`;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <Text className={styles.title}>
            {t('callcenter.settings.pauseReasons.title', 'Причины пауз')}
          </Text>
          <Button type="button" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            {t('callcenter.settings.pauseReasons.add', 'Добавить причину')}
          </Button>
        </div>
        <Text className={styles.hint}>
          {t(
            'callcenter.settings.pauseReasons.hint',
            'Каталог причин паузы для операторов. Длительность — в минутах (0 = без лимита).',
          )}
        </Text>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <Text>{t('callcenter.settings.pauseReasons.empty', 'Причин пауз пока нет')}</Text>
          <Button type="button" variant="outline" onClick={openCreate}>
            {t('callcenter.settings.pauseReasons.add', 'Добавить причину')}
          </Button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('callcenter.pauseReasons.name', 'Название')}</th>
                <th>{t('callcenter.pauseReasons.color', 'Цвет')}</th>
                <th>{t('callcenter.pauseReasons.maxDuration', 'Макс. длительность (мин)')}</th>
                <th>{t('callcenter.pauseReasons.isPaid', 'Оплачиваемая')}</th>
                <th>{t('callcenter.pauseReasons.sortOrder', 'Порядок')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.uid}>
                  <td>{row.name}</td>
                  <td>
                    <span
                      className={styles.swatch}
                      style={{ backgroundColor: row.color || DEFAULT_COLOR }}
                      title={row.color}
                    />
                    <span className={styles.tabular}>{row.color || DEFAULT_COLOR}</span>
                  </td>
                  <td className={styles.tabular}>{formatDuration(row.max_duration)}</td>
                  <td>
                    {row.is_paid
                      ? t('callcenter.pause.paid', 'Оплачив.')
                      : t('callcenter.settings.pauseReasons.unpaid', 'Нет')}
                  </td>
                  <td className={styles.tabular}>{row.sort_order ?? 0}</td>
                  <td className={styles.actions}>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      {t('callcenter.settings.pauseReasons.edit', 'Изменить')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {t('common.delete', 'Удалить')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t('callcenter.pauseReasons.edit', 'Редактировать причину')
                : t('callcenter.pauseReasons.add', 'Добавить причину')}
            </DialogTitle>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <Label htmlFor="pr-name">{t('callcenter.pauseReasons.name', 'Название')}</Label>
              <Input
                id="pr-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="pr-color">{t('callcenter.pauseReasons.color', 'Цвет')}</Label>
              <div className={styles.colorRow}>
                <input
                  id="pr-color"
                  type="color"
                  className={styles.colorPicker}
                  value={form.color || DEFAULT_COLOR}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder={DEFAULT_COLOR}
                />
              </div>
            </div>
            <div className={styles.field}>
              <Label htmlFor="pr-max">
                {t('callcenter.pauseReasons.maxDuration', 'Макс. длительность (мин)')}
              </Label>
              <Input
                id="pr-max"
                type="number"
                min={0}
                value={form.max_duration}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setForm((f) => ({ ...f, max_duration: Number.isFinite(n) ? Math.max(0, n) : 0 }));
                }}
              />
            </div>
            <div className={styles.row}>
              <Label htmlFor="pr-paid">{t('callcenter.pauseReasons.isPaid', 'Оплачиваемая')}</Label>
              <Switch
                id="pr-paid"
                checked={form.is_paid}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_paid: checked }))}
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="pr-sort">{t('callcenter.pauseReasons.sortOrder', 'Порядок')}</Label>
              <Input
                id="pr-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setForm((f) => ({ ...f, sort_order: Number.isFinite(n) ? n : 0 }));
                }}
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
              onClick={() => void handleSave()}
            >
              {t('callcenter.settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.settings.pauseReasons.deleteTitle', 'Удалить причину?')}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t('callcenter.pauseReasons.confirmDelete', {
              name: deleteTarget?.name ?? '',
              defaultValue: `Удалить причину паузы «${deleteTarget?.name ?? ''}»?`,
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
              onClick={() => void handleDelete()}
            >
              {t('common.delete', 'Удалить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
