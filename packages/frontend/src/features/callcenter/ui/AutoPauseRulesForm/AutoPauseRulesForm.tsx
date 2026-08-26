import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Select, Switch, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  type AutoPauseRule,
  useGetPauseReasonsQuery,
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { agentStatusLabel, AGENT_STATUS_LABEL_KEYS } from '@/features/callcenter/lib/displayLabels';
import type { AgentStatus } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './AutoPauseRulesForm.module.scss';

type RuleType = AutoPauseRule['type'];

const RULE_TYPES: RuleType[] = ['missed_count', 'idle_time', 'status_duration'];

/** Statuses offered for status_duration rules - same labels as the agent status bar. */
const STATUS_DURATION_OPTIONS = Object.keys(AGENT_STATUS_LABEL_KEYS) as AgentStatus[];

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

function normalizeStatusOption(status: string): AgentStatus {
  if ((STATUS_DURATION_OPTIONS as string[]).includes(status)) {
    return status as AgentStatus;
  }
  return 'WRAPUP';
}

/**
 * Tenant auto-pause editor (D-15).
 * Master switch `autopause_enabled`: when off, RONA + rules do not fire.
 * When on, RONA is active and additional missed_count / idle_time / status_duration
 * rules can be configured. SUPERVISOR/ADMIN only (same gate as AlertThresholdsForm).
 */
export function AutoPauseRulesForm() {
  const { t } = useTranslation();
  const tLabel = (key: string, fallback = ''): string => t(key, fallback);
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const { data: pauseReasons = [] } = useGetPauseReasonsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<AutoPauseRule[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.autopause_enabled !== false);
    setRules(normalizeRules(data.autopause_rules));
  }, [data]);

  const rulesEditable = canEdit && enabled;

  const updateRule = (index: number, next: AutoPauseRule) => {
    if (!rulesEditable) return;
    setRules((prev) => prev.map((r, i) => (i === index ? next : r)));
    setSaved(false);
  };

  const changeType = (index: number, type: RuleType) => {
    if (!rulesEditable) return;
    const prev = rules[index];
    const next = defaultRule(type);
    if (prev.pauseReasonId !== undefined) next.pauseReasonId = prev.pauseReasonId;
    if (prev.pauseDurationSec !== undefined) next.pauseDurationSec = prev.pauseDurationSec;
    updateRule(index, next);
  };

  const addRule = () => {
    if (!rulesEditable) return;
    setRules((prev) => [...prev, defaultRule()]);
    setSaved(false);
  };

  const removeRule = (index: number) => {
    if (!rulesEditable) return;
    setRules((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({
        autopause_enabled: enabled,
        autopause_rules: rules,
      }).unwrap();
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

      <div className={styles.row}>
        <Label htmlFor="cc-ap-enabled" className={styles.label}>
          {t('callcenter.settings.autoPause.enabled')}
        </Label>
        <Switch
          id="cc-ap-enabled"
          checked={enabled}
          disabled={!canEdit}
          onCheckedChange={(next) => {
            if (!canEdit) return;
            setEnabled(next);
            setSaved(false);
          }}
        />
      </div>
      <Text className={styles.hint}>{t('callcenter.settings.autoPause.enabledHint')}</Text>

      {enabled ? (
        <Text className={styles.ronaInfo}>{t('callcenter.settings.autoPause.ronaWhenEnabled')}</Text>
      ) : (
        <Text className={styles.ronaInfo}>{t('callcenter.settings.autoPause.disabledInfo')}</Text>
      )}

      <div className={styles.section}>
        <Text className={styles.sectionTitle}>{t('callcenter.settings.autoPause.rules')}</Text>

        {!enabled && (
          <Text className={styles.empty}>{t('callcenter.settings.autoPause.rulesDisabled')}</Text>
        )}

        {enabled && rules.length === 0 && (
          <Text className={styles.empty}>{t('callcenter.settings.autoPause.empty')}</Text>
        )}

        {enabled &&
          rules.map((rule, index) => (
            <div key={index} className={styles.ruleCard}>
              <div className={styles.ruleHeader}>
                <div className={styles.fieldGrow}>
                  <Label htmlFor={`cc-ap-type-${index}`} className={styles.fieldLabel}>
                    {t('callcenter.settings.autoPause.fields.type')}
                  </Label>
                  <Select
                    id={`cc-ap-type-${index}`}
                    className={styles.control}
                    value={rule.type}
                    disabled={!rulesEditable}
                    onChange={(e) => changeType(index, e.target.value as RuleType)}
                  >
                    {RULE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`callcenter.settings.autoPause.types.${type}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                {rulesEditable && (
                  <Button
                    type="button"
                    variant="outline"
                    className={styles.removeBtn}
                    onClick={() => removeRule(index)}
                  >
                    {t('callcenter.settings.autoPause.remove')}
                  </Button>
                )}
              </div>

              {/* Fixed 4-slot grid so cards stay aligned regardless of rule type */}
              <div className={styles.ruleFields}>
                <div className={styles.field}>
                  {rule.type === 'missed_count' ? (
                    <>
                      <Label htmlFor={`cc-ap-threshold-${index}`} className={styles.fieldLabel}>
                        {t('callcenter.settings.autoPause.fields.threshold')}
                      </Label>
                      <Input
                        id={`cc-ap-threshold-${index}`}
                        className={styles.control}
                        type="number"
                        min={1}
                        value={rule.threshold}
                        disabled={!rulesEditable}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          updateRule(index, { ...rule, threshold: n });
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Label htmlFor={`cc-ap-threshold-sec-${index}`} className={styles.fieldLabel}>
                        {t('callcenter.settings.autoPause.fields.thresholdSec')}
                      </Label>
                      <Input
                        id={`cc-ap-threshold-sec-${index}`}
                        className={styles.control}
                        type="number"
                        min={1}
                        value={rule.thresholdSec}
                        disabled={!rulesEditable}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          updateRule(index, { ...rule, thresholdSec: n });
                        }}
                      />
                    </>
                  )}
                </div>

                <div
                  className={
                    rule.type === 'status_duration'
                      ? styles.field
                      : `${styles.field} ${styles.fieldEmpty}`
                  }
                >
                  {rule.type === 'status_duration' ? (
                    <>
                      <Label htmlFor={`cc-ap-status-${index}`} className={styles.fieldLabel}>
                        {t('callcenter.settings.autoPause.fields.status')}
                      </Label>
                      <Select
                        id={`cc-ap-status-${index}`}
                        className={styles.control}
                        value={normalizeStatusOption(rule.status)}
                        disabled={!rulesEditable}
                        onChange={(e) =>
                          updateRule(index, {
                            ...rule,
                            status: e.target.value as AgentStatus,
                          })
                        }
                      >
                        {STATUS_DURATION_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {agentStatusLabel(status, tLabel)}
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <div className={styles.fieldSpacer} aria-hidden />
                  )}
                </div>

                <div className={styles.field}>
                  <Label htmlFor={`cc-ap-reason-${index}`} className={styles.fieldLabel}>
                    {t('callcenter.settings.autoPause.fields.pauseReasonId')}
                  </Label>
                  <Select
                    id={`cc-ap-reason-${index}`}
                    className={styles.control}
                    value={rule.pauseReasonId ?? ''}
                    disabled={!rulesEditable}
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
                  <Label htmlFor={`cc-ap-duration-${index}`} className={styles.fieldLabel}>
                    {t('callcenter.settings.autoPause.fields.pauseDurationSec')}
                  </Label>
                  <Input
                    id={`cc-ap-duration-${index}`}
                    className={styles.control}
                    type="number"
                    min={0}
                    value={rule.pauseDurationSec ?? ''}
                    disabled={!rulesEditable}
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
          {enabled && (
            <Button type="button" variant="outline" onClick={addRule}>
              {t('callcenter.settings.autoPause.add')}
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {t('callcenter.settings.save')}
          </Button>
          {saved && <Text className={styles.saved}>{t('callcenter.settings.autoPause.saved')}</Text>}
        </div>
      )}
    </form>
  );
}
