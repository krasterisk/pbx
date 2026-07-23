import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Select, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  type AutoPauseRule,
  useGetPauseReasonsQuery,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './AutoPauseRulesForm.module.scss';

type RuleType = AutoPauseRule['type'];

const RULE_TYPES: RuleType[] = ['missed_count', 'idle_time', 'status_duration'];

function defaultRule(type: RuleType = 'missed_count'): AutoPauseRule {
  if (type === 'idle_time') {
    return { type: 'idle_time', thresholdSec: 300 };
  }
  if (type === 'status_duration') {
    return { type: 'status_duration', status: 'WRAPUP', thresholdSec: 60 };
  }
  return { type: 'missed_count', threshold: 3 };
}

function normalizeRules(raw: AutoPauseRule[] | null | undefined): AutoPauseRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => RULE_TYPES.includes(r.type));
}

/**
 * Tenant auto-pause rules editor (D-15 / G-09-2).
 * RONA is always-on and not editable; only missed_count / idle_time / status_duration.
 * Editable by supervisor/admin (same gate as AlertThresholdsForm).
 */
export function AutoPauseRulesForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const { data: pauseReasons = [] } = useGetPauseReasonsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [rules, setRules] = useState<AutoPauseRule[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRules(normalizeRules(data.autopause_rules));
  }, [data]);

  const updateRule = (index: number, next: AutoPauseRule) => {
    if (!canEdit) return;
    setRules((prev) => prev.map((r, i) => (i === index ? next : r)));
    setSaved(false);
  };

  const changeType = (index: number, type: RuleType) => {
    if (!canEdit) return;
    const prev = rules[index];
    const next = defaultRule(type);
    if (prev.pauseReasonId !== undefined) next.pauseReasonId = prev.pauseReasonId;
    if (prev.pauseDurationSec !== undefined) next.pauseDurationSec = prev.pauseDurationSec;
    updateRule(index, next);
  };

  const addRule = () => {
    if (!canEdit) return;
    setRules((prev) => [...prev, defaultRule()]);
    setSaved(false);
  };

  const removeRule = (index: number) => {
    if (!canEdit) return;
    setRules((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({ autopause_rules: rules }).unwrap();
      setSaved(true);
      toast.success(t('callcenter.settings.autoPause.saved'));
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
      <Text className={styles.sectionTitle}>{t('callcenter.settings.autoPause.title')}</Text>

      {!canEdit && (
        <Text className={styles.readonlyHint}>{t('callcenter.settings.autoPause.readOnly')}</Text>
      )}

      <Text className={styles.ronaInfo}>{t('callcenter.settings.autoPause.ronaInfo')}</Text>

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.autoPause.rules')}</Text>

        {rules.length === 0 && (
          <Text className={styles.empty}>{t('callcenter.settings.autoPause.empty')}</Text>
        )}

        {rules.map((rule, index) => (
          <div key={index} className={styles.ruleCard}>
            <div className={styles.ruleHeader}>
              <div className={styles.field} style={{ flex: 1 }}>
                <Label htmlFor={`cc-ap-type-${index}`}>
                  {t('callcenter.settings.autoPause.fields.type')}
                </Label>
                <Select
                  id={`cc-ap-type-${index}`}
                  value={rule.type}
                  disabled={!canEdit}
                  onChange={(e) => changeType(index, e.target.value as RuleType)}
                >
                  {RULE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`callcenter.settings.autoPause.types.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeRule(index)}
                >
                  {t('callcenter.settings.autoPause.remove')}
                </Button>
              )}
            </div>

            <div className={styles.ruleFields}>
              {rule.type === 'missed_count' && (
                <div className={styles.field}>
                  <Label htmlFor={`cc-ap-threshold-${index}`}>
                    {t('callcenter.settings.autoPause.fields.threshold')}
                  </Label>
                  <Input
                    id={`cc-ap-threshold-${index}`}
                    type="number"
                    min={1}
                    value={rule.threshold}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      updateRule(index, { ...rule, threshold: n });
                    }}
                  />
                </div>
              )}

              {(rule.type === 'idle_time' || rule.type === 'status_duration') && (
                <div className={styles.field}>
                  <Label htmlFor={`cc-ap-threshold-sec-${index}`}>
                    {t('callcenter.settings.autoPause.fields.thresholdSec')}
                  </Label>
                  <Input
                    id={`cc-ap-threshold-sec-${index}`}
                    type="number"
                    min={1}
                    value={rule.thresholdSec}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      updateRule(index, { ...rule, thresholdSec: n });
                    }}
                  />
                </div>
              )}

              {rule.type === 'status_duration' && (
                <div className={styles.field}>
                  <Label htmlFor={`cc-ap-status-${index}`}>
                    {t('callcenter.settings.autoPause.fields.status')}
                  </Label>
                  <Input
                    id={`cc-ap-status-${index}`}
                    type="text"
                    value={rule.status}
                    disabled={!canEdit}
                    onChange={(e) => updateRule(index, { ...rule, status: e.target.value })}
                  />
                </div>
              )}

              <div className={styles.field}>
                <Label htmlFor={`cc-ap-reason-${index}`}>
                  {t('callcenter.settings.autoPause.fields.pauseReasonId')}
                </Label>
                <Select
                  id={`cc-ap-reason-${index}`}
                  value={rule.pauseReasonId ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      const next = { ...rule };
                      delete (next as { pauseReasonId?: number }).pauseReasonId;
                      updateRule(index, next);
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    updateRule(index, { ...rule, pauseReasonId: n });
                  }}
                >
                  <option value="">
                    {t('callcenter.settings.autoPause.fields.pauseReasonNone')}
                  </option>
                  {pauseReasons.map((pr) => (
                    <option key={pr.uid} value={pr.uid}>
                      {pr.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className={styles.field}>
                <Label htmlFor={`cc-ap-duration-${index}`}>
                  {t('callcenter.settings.autoPause.fields.pauseDurationSec')}
                </Label>
                <Input
                  id={`cc-ap-duration-${index}`}
                  type="number"
                  min={0}
                  value={rule.pauseDurationSec ?? ''}
                  disabled={!canEdit}
                  placeholder={t('callcenter.settings.autoPause.fields.pauseDurationPh')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      const next = { ...rule };
                      delete (next as { pauseDurationSec?: number }).pauseDurationSec;
                      updateRule(index, next);
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    updateRule(index, { ...rule, pauseDurationSec: n });
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={addRule}>
            {t('callcenter.settings.autoPause.add')}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {t('callcenter.settings.save')}
          </Button>
          {saved && <Text className={styles.saved}>{t('callcenter.settings.autoPause.saved')}</Text>}
        </div>
      )}
    </form>
  );
}
