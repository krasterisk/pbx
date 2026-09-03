import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  CALLBACK_DIAL_ORDERS,
  CALLBACK_ORDER_MODES,
  DEFAULT_CALLBACK_POLICY,
  type CallbackDialOrder,
  type CallbackOrderMode,
  type ICallbackPolicy,
} from '@krasterisk/shared';
import { Button, InfoTooltip, Label, SegmentedControl, Select, Text, Skeleton } from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './CallbackSettingsForm.module.scss';

const DTMF_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'] as const;

export function normalizeCallbackPolicy(raw: ICallbackPolicy | null | undefined): ICallbackPolicy {
  const next: ICallbackPolicy = { ...DEFAULT_CALLBACK_POLICY };
  if (!raw || typeof raw !== 'object') return next;
  if ((CALLBACK_ORDER_MODES as readonly string[]).includes(raw.order_mode)) {
    next.order_mode = raw.order_mode;
  }
  if (typeof raw.dtmf_digit === 'string' && /^[0-9*#]$/.test(raw.dtmf_digit)) {
    next.dtmf_digit = raw.dtmf_digit;
  }
  if (
    typeof raw.dial_order === 'string'
    && (CALLBACK_DIAL_ORDERS as readonly string[]).includes(raw.dial_order)
  ) {
    next.dial_order = raw.dial_order as CallbackDialOrder;
  }
  if (next.order_mode === 'queue_abandon') {
    delete next.dtmf_digit;
  }
  return next;
}

function policyForSave(policy: ICallbackPolicy): ICallbackPolicy {
  if (policy.order_mode === 'queue_abandon') {
    const { dtmf_digit: _omit, ...rest } = policy;
    return rest;
  }
  return {
    ...policy,
    dtmf_digit: policy.dtmf_digit ?? DEFAULT_CALLBACK_POLICY.dtmf_digit,
  };
}

/** Tenant callback order / DTMF / dial-order policy (SUPERVISOR/ADMIN). D-49 Surface L. */
export function CallbackSettingsForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [policy, setPolicy] = useState<ICallbackPolicy>({ ...DEFAULT_CALLBACK_POLICY });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPolicy(normalizeCallbackPolicy(data.callback_policy));
  }, [data]);

  const patch = (partial: Partial<ICallbackPolicy>) => {
    if (!canEdit) return;
    setPolicy((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await update({ callback_policy: policyForSave(policy) }).unwrap();
      setSaved(true);
      toast.success(t('callcenter.settings.callback.saved', 'Callback settings saved'));
    } catch {
      toast.error(t('common.saveFailed', 'Save failed'));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.wrap} data-testid="callback-settings-form">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.wrap}>
        <Text variant="error">{t('common.loadFailed', 'Failed to load')}</Text>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  const showDtmf = policy.order_mode !== 'queue_abandon';

  return (
    <div className={styles.wrap} data-testid="callback-settings-form">
      <Text className={styles.title}>
        {t('callcenter.settings.callback.title', 'Callback')}
      </Text>
      <Text variant="muted" className={styles.hint}>
        {t(
          'callcenter.settings.callback.hint',
          'How callers request a callback and in which order the system connects them to an agent',
        )}
      </Text>

      {!canEdit && (
        <Text variant="muted" className={styles.readOnly}>
          {t(
            'callcenter.settings.callback.readOnly',
            'Only supervisors and admins can change these settings',
          )}
        </Text>
      )}

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <Label>
            {t('callcenter.settings.callback.orderMode', 'How a callback is requested')}
          </Label>
        </div>
        <SegmentedControl<CallbackOrderMode>
          ariaLabel={t('callcenter.settings.callback.orderMode', 'How a callback is requested')}
          value={policy.order_mode}
          onChange={(v) => patch({ order_mode: v })}
          options={[
            {
              value: 'subscriber',
              label: t('callcenter.settings.callback.orderSubscriber', "At the caller's choice"),
              disabled: !canEdit,
            },
            {
              value: 'queue_abandon',
              label: t(
                'callcenter.settings.callback.orderAbandon',
                'Automatically when a caller abandons the queue',
              ),
              disabled: !canEdit,
            },
            {
              value: 'both',
              label: t('callcenter.settings.callback.orderBoth', 'Both ways'),
              disabled: !canEdit,
            },
          ]}
        />
      </div>

      {showDtmf && (
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <Label htmlFor="callback-dtmf-digit">
              {t('callcenter.settings.callback.dtmfDigit', 'Key to request a callback')}
            </Label>
            <InfoTooltip
              text={t(
                'callcenter.settings.callback.dtmfHint',
                'The caller presses it while waiting in the queue',
              )}
            />
          </div>
          <Select
            id="callback-dtmf-digit"
            className={styles.mono}
            disabled={!canEdit}
            value={policy.dtmf_digit ?? DEFAULT_CALLBACK_POLICY.dtmf_digit}
            onChange={(e) => patch({ dtmf_digit: e.target.value })}
          >
            {DTMF_DIGITS.map((digit) => (
              <option key={digit} value={digit} className={styles.mono}>
                {digit}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <Label>{t('callcenter.settings.callback.dialOrder', 'Dial order')}</Label>
          <InfoTooltip
            text={t(
              'callcenter.settings.callback.dialOrderHint',
              '**Agent first** - the caller rings once an agent is already on the line\n**Caller first** - the agent joins a call the caller has already picked up',
            )}
          />
        </div>
        <SegmentedControl<CallbackDialOrder>
          ariaLabel={t('callcenter.settings.callback.dialOrder', 'Dial order')}
          value={policy.dial_order ?? DEFAULT_CALLBACK_POLICY.dial_order ?? 'agent_first'}
          onChange={(v) => patch({ dial_order: v })}
          options={[
            {
              value: 'agent_first',
              label: t('callcenter.settings.callback.dialAgentFirst', 'Agent first'),
              disabled: !canEdit,
            },
            {
              value: 'caller_first',
              label: t('callcenter.settings.callback.dialCallerFirst', 'Caller first'),
              disabled: !canEdit,
            },
          ]}
        />
      </div>

      <Text variant="muted" className={styles.note}>
        {t(
          'callcenter.settings.callback.stepParamsNote',
          'The dial window and the number of attempts are set in the "Callback" action itself and differ per route',
        )}
      </Text>

      {canEdit && (
        <div className={styles.footer}>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? t('common.saving', 'Saving…')
              : saved
                ? t('common.saved', 'Saved')
                : t('callcenter.settings.callback.save', 'Save callback settings')}
          </Button>
        </div>
      )}
    </div>
  );
}
