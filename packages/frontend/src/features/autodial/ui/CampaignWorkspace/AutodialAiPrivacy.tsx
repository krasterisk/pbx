import { useAutodialConfirmation } from '../AutodialConfirmation/useAutodialConfirmation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Label, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectUserLevel } from '@/entities/User';
import { useGetAutodialAiPrivacyQuery, useUpdateAutodialAiPrivacyMutation } from '@/shared/api/endpoints/autodialApi';

export function AutodialAiPrivacy() {
  const { t } = useTranslation();
  const { confirm, confirmationDialog } = useAutodialConfirmation();
  const level = useAppSelector(selectUserLevel);
  const { currentData, isError } = useGetAutodialAiPrivacyQuery();
  const [update, { isLoading }] = useUpdateAutodialAiPrivacyMutation();
  const [failed, setFailed] = useState(false);
  return <VStack align="stretch" gap="8" max>
    {confirmationDialog}
    <Label htmlFor="autodial-pii">{t('autodial.workspace.aiPrivacyTitle')}</Label>
    <Text variant="muted">{t('autodial.workspace.aiPrivacyBody')}</Text>
    <Checkbox id="autodial-pii" checked={currentData?.allow_personal_data ?? false}
      disabled={!currentData || isLoading || ![0, 1].includes(Number(level))}
      onChange={async (event) => {
        const enabled = event.target.checked;
        if (enabled && !(await confirm(t('autodial.workspace.aiPrivacyConfirm')))) return;
        setFailed(false);
        try { await update({ allow_personal_data: enabled }).unwrap(); } catch { setFailed(true); }
      }} />
    {(failed || isError) && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
  </VStack>;
}
