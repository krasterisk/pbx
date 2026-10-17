import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  AGENT_HOTKEY_ACTIONS,
  DEFAULT_AGENT_HOTKEYS,
  describeHotkey,
  eventToHotkey,
  resolveAgentHotkeys,
  validateHotkeyMap,
  type AgentHotkeyAction,
  type AgentHotkeyMap,
} from '@krasterisk/shared';
import { Button, Flex, Input, Skeleton, Text, VStack } from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { FormSaveBar } from '../FormSaveBar';
import styles from './HotkeysSettingsForm.module.scss';

/** Only the entries that differ from the defaults go to the server; none -> `null` (reset). */
function toOverride(map: AgentHotkeyMap): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const action of AGENT_HOTKEY_ACTIONS) {
    if (map[action] !== DEFAULT_AGENT_HOTKEYS[action]) out[action] = map[action];
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Tenant agent hotkeys (U5.6): record a shortcut per action, conflicts are flagged before saving. */
export function HotkeysSettingsForm() {
  const { t } = useTranslation();
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [draft, setDraft] = useState<AgentHotkeyMap>({ ...DEFAULT_AGENT_HOTKEYS });

  const saved = useMemo(() => resolveAgentHotkeys(data?.agent_hotkeys ?? null), [data?.agent_hotkeys]);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const issues = useMemo(() => {
    const byAction = new Map<string, string>();
    for (const issue of validateHotkeyMap(draft).issues) byAction.set(issue.action, issue.code);
    return byAction;
  }, [draft]);

  const dirty = AGENT_HOTKEY_ACTIONS.some((a) => draft[a] !== saved[a]);

  const setCombo = (action: AgentHotkeyAction, combo: string) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [action]: combo }));
  };

  const handleSave = async () => {
    if (!canEdit || issues.size > 0) return;
    try {
      await update({ agent_hotkeys: toOverride(draft) }).unwrap();
      toast.success(t('callcenter.settings.hotkeys.saved', 'Hotkeys saved'));
    } catch {
      toast.error(t('common.saveFailed', 'Save failed'));
    }
  };

  if (isLoading) {
    return (
      <VStack gap="8" max data-testid="hotkeys-settings-form">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </VStack>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message={t('common.loadFailed', 'Failed to load')}
        onRetry={() => refetch()}
        retryLabel={t('common.retry', 'Retry')}
      />
    );
  }

  return (
    <VStack gap="12" max className={styles.wrap} data-testid="hotkeys-settings-form">
      <Text className={styles.title}>{t('callcenter.settings.hotkeys.title', 'Agent hotkeys')}</Text>
      <Text variant="muted">
        {t('callcenter.settings.hotkeys.hint', 'One set for all operators. Works in the agent workspace, including the Russian keyboard layout.')}
      </Text>
      {!canEdit && (
        <Text variant="muted">
          {t('callcenter.settings.hotkeys.readOnly', 'Only supervisors and admins can edit')}
        </Text>
      )}

      <VStack gap="4" max>
        {AGENT_HOTKEY_ACTIONS.map((action) => {
          const issue = issues.get(action);
          const isDefault = draft[action] === DEFAULT_AGENT_HOTKEYS[action];
          return (
            <Flex
              key={action}
              align="center"
              gap="12"
              wrap="wrap"
              className={styles.row}
              data-testid={`hotkey-row-${action}`}
            >
              <Text className={styles.label}>
                {t(`callcenter.settings.hotkeys.action.${action}`, action)}
              </Text>
              <Input
                readOnly
                value={describeHotkey(draft[action])}
                disabled={!canEdit}
                aria-label={t(`callcenter.settings.hotkeys.action.${action}`, action)}
                aria-invalid={issue ? true : undefined}
                placeholder={t('callcenter.settings.hotkeys.record', 'Press a shortcut…')}
                className={styles.input}
                data-testid={`hotkey-input-${action}`}
                onKeyDown={(e) => {
                  if (!canEdit || e.key === 'Tab' || e.key === 'Escape') return;
                  e.preventDefault();
                  const combo = eventToHotkey(e.nativeEvent);
                  if (combo) setCombo(action, combo);
                }}
              />
              {canEdit && !isDefault && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCombo(action, DEFAULT_AGENT_HOTKEYS[action])}
                  data-testid={`hotkey-reset-${action}`}
                >
                  {t('callcenter.settings.hotkeys.resetRow', 'Default')}: {describeHotkey(DEFAULT_AGENT_HOTKEYS[action])}
                </Button>
              )}
              {issue && (
                <Text className={styles.error} role="alert" data-testid={`hotkey-error-${action}`}>
                  {t(`callcenter.settings.hotkeys.errors.${issue}`, issue)}
                </Text>
              )}
            </Flex>
          );
        })}
      </VStack>

      {canEdit && (
        <Flex gap="8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ ...DEFAULT_AGENT_HOTKEYS })}
            data-testid="hotkeys-reset-all"
          >
            {t('callcenter.settings.hotkeys.reset', 'Reset to defaults')}
          </Button>
        </Flex>
      )}

      <Text variant="muted" className={styles.recordHint}>
        {t('callcenter.settings.hotkeys.recordHint', 'Click the field and press a shortcut with Alt')}
      </Text>

      <FormSaveBar
        dirty={dirty}
        saving={isSaving}
        saveDisabled={issues.size > 0}
        onSave={handleSave}
        onCancel={() => setDraft(saved)}
        testId="hotkeys-save-bar"
      />
    </VStack>
  );
}
