import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Select, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectCurrentUser, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useGetUsersQuery } from '@/shared/api/endpoints/userApi';
import {
  useGetMyOperatorSettingsQuery,
  useUpdateMyOperatorSettingsMutation,
  useGetOperatorSettingsQuery,
  useUpdateOperatorSettingsMutation,
  type IOperatorSettings,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './OperatorSettingsForm.module.scss';

const DEFAULTS: IOperatorSettings = {
  pickup_enabled: false,
  auto_answer: false,
  auto_answer_zip_tone: true,
  wrapup_timeout: 30,
  wrapup_extend_step: 30,
  wrapup_autosave_draft: true,
  sound_incoming: true,
  sound_missed: true,
  notifications_enabled: true,
  volume: 100,
};

function toForm(data: IOperatorSettings): IOperatorSettings {
  return {
    pickup_enabled: data.pickup_enabled,
    auto_answer: data.auto_answer,
    auto_answer_zip_tone: data.auto_answer_zip_tone,
    wrapup_timeout: data.wrapup_timeout,
    wrapup_extend_step: data.wrapup_extend_step,
    wrapup_autosave_draft: data.wrapup_autosave_draft,
    sound_incoming: data.sound_incoming,
    sound_missed: data.sound_missed,
    notifications_enabled: data.notifications_enabled,
    volume: data.volume,
  };
}

/**
 * Per-operator CC settings form (D-22) for /callcenter/settings tab.
 * ADMIN/SUPERVISOR can pick another operator and edit via /operator/:operatorId.
 */
export function OperatorSettingsForm() {
  const { t } = useTranslation();
  const currentUser = useAppSelector(selectCurrentUser);
  const level = useAppSelector(selectUserLevel);
  const canPickOperator = level === UserLevel.ADMIN || level === UserLevel.SUPERVISOR;
  const selfId = currentUser?.uniqueid ?? 0;

  const [selectedId, setSelectedId] = useState<number>(selfId);
  const [form, setForm] = useState<IOperatorSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (selfId && selectedId === 0) {
      setSelectedId(selfId);
    }
  }, [selfId, selectedId]);

  const isSelf = selectedId === selfId;

  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !canPickOperator });
  const operatorOptions = useMemo(
    () =>
      users
        .filter((u) => u.level === UserLevel.OPERATOR || u.level === UserLevel.SUPERVISOR)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name) || a.login.localeCompare(b.login)),
    [users],
  );

  const myQuery = useGetMyOperatorSettingsQuery(undefined, { skip: !isSelf || !selfId });
  const byIdQuery = useGetOperatorSettingsQuery(selectedId, {
    skip: isSelf || !selectedId || !canPickOperator,
  });

  const [updateMy, { isLoading: isSavingMy }] = useUpdateMyOperatorSettingsMutation();
  const [updateById, { isLoading: isSavingById }] = useUpdateOperatorSettingsMutation();

  const data = isSelf ? myQuery.data : byIdQuery.data;
  const isLoading = isSelf ? myQuery.isLoading : byIdQuery.isLoading;
  const isError = isSelf ? myQuery.isError : byIdQuery.isError;
  const refetch = isSelf ? myQuery.refetch : byIdQuery.refetch;
  const isSaving = isSavingMy || isSavingById;

  useEffect(() => {
    if (data) {
      setForm(toForm(data));
      setSaved(false);
    }
  }, [data, selectedId]);

  const setBool = (key: keyof IOperatorSettings) => (checked: boolean) => {
    setForm((prev) => ({ ...prev, [key]: checked }));
    setSaved(false);
  };

  const setNum = (key: keyof IOperatorSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      if (isSelf) {
        await updateMy(form).unwrap();
      } else {
        await updateById({ operatorId: selectedId, body: form }).unwrap();
      }
      setSaved(true);
      toast.success(t('callcenter.settings.operator.saved'));
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error(t('common.error', 'Ошибка сохранения'));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
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
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      {canPickOperator && (
        <div className={styles.picker}>
          <Label htmlFor="op-picker">{t('callcenter.settings.operator.pickOperator')}</Label>
          <Select
            id="op-picker"
            value={selectedId || ''}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next) && next > 0) {
                setSelectedId(next);
                setSaved(false);
              }
            }}
          >
            {selfId > 0 &&
              !operatorOptions.some((u) => u.uniqueid === selfId) && (
                <option value={selfId}>
                  {currentUser?.name || currentUser?.login || selfId} (#{selfId})
                </option>
              )}
            {operatorOptions.map((u) => (
              <option key={u.uniqueid} value={u.uniqueid}>
                {u.name || u.login} ({u.login}) #{u.uniqueid}
              </option>
            ))}
          </Select>
          <Text className={styles.hint}>{t('callcenter.settings.operator.pickHint')}</Text>
        </div>
      )}

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.operator.pickup')}</Text>
        <div className={styles.row}>
          <Label htmlFor="op-pickup" className={styles.label}>
            {t('callcenter.settings.operator.pickupEnabled')}
          </Label>
          <Switch
            id="op-pickup"
            checked={form.pickup_enabled}
            onCheckedChange={setBool('pickup_enabled')}
          />
        </div>
      </div>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.operator.autoAnswer')}</Text>
        <div className={styles.row}>
          <Label htmlFor="op-auto-answer" className={styles.label}>
            {t('callcenter.settings.operator.autoAnswerEnabled')}
          </Label>
          <Switch
            id="op-auto-answer"
            checked={form.auto_answer}
            onCheckedChange={setBool('auto_answer')}
          />
        </div>
        <div className={styles.row}>
          <Label htmlFor="op-zip-tone" className={styles.label}>
            {t('callcenter.settings.operator.zipTone')}
          </Label>
          <Switch
            id="op-zip-tone"
            checked={form.auto_answer_zip_tone}
            onCheckedChange={setBool('auto_answer_zip_tone')}
            disabled={!form.auto_answer}
          />
        </div>
      </div>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.operator.wrapup')}</Text>
        <div className={styles.field}>
          <Label htmlFor="op-wrapup-timeout">{t('callcenter.settings.operator.wrapupTimeout')}</Label>
          <Input
            id="op-wrapup-timeout"
            type="number"
            min={0}
            value={form.wrapup_timeout}
            onChange={setNum('wrapup_timeout')}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="op-wrapup-step">{t('callcenter.settings.operator.wrapupExtend')}</Label>
          <Input
            id="op-wrapup-step"
            type="number"
            min={0}
            value={form.wrapup_extend_step}
            onChange={setNum('wrapup_extend_step')}
          />
        </div>
        <div className={styles.row}>
          <Label htmlFor="op-wrapup-autosave" className={styles.label}>
            {t('callcenter.settings.operator.wrapupAutosave')}
          </Label>
          <Switch
            id="op-wrapup-autosave"
            checked={form.wrapup_autosave_draft}
            onCheckedChange={setBool('wrapup_autosave_draft')}
          />
        </div>
      </div>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.operator.notifications')}</Text>
        <div className={styles.row}>
          <Label htmlFor="op-sound-in" className={styles.label}>
            {t('callcenter.settings.operator.soundIncoming')}
          </Label>
          <Switch
            id="op-sound-in"
            checked={form.sound_incoming}
            onCheckedChange={setBool('sound_incoming')}
          />
        </div>
        <div className={styles.row}>
          <Label htmlFor="op-sound-missed" className={styles.label}>
            {t('callcenter.settings.operator.soundMissed')}
          </Label>
          <Switch
            id="op-sound-missed"
            checked={form.sound_missed}
            onCheckedChange={setBool('sound_missed')}
          />
        </div>
        <div className={styles.row}>
          <Label htmlFor="op-browser-notif" className={styles.label}>
            {t('callcenter.settings.operator.browserNotifications')}
          </Label>
          <Switch
            id="op-browser-notif"
            checked={form.notifications_enabled}
            onCheckedChange={setBool('notifications_enabled')}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="op-volume">{t('callcenter.settings.operator.volume')}</Label>
          <Input
            id="op-volume"
            type="number"
            min={0}
            max={100}
            value={form.volume}
            onChange={setNum('volume')}
          />
          <Text className={styles.hint}>{t('callcenter.settings.operator.volumeHint')}</Text>
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isSaving}>
          {t('callcenter.settings.save')}
        </Button>
        {saved && <Text className={styles.saved}>{t('callcenter.settings.operator.saved')}</Text>}
      </div>
    </form>
  );
}
