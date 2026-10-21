import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGetCompanyCallPolicyQuery,
  useSetCompanyCallPolicyMutation,
} from '@/shared/api/endpoints/callsApi';
import { Button, Input, Label, Text, VStack, Flex, InfoTooltip } from '@/shared/ui';
import cls from './Calls.module.scss';

export function CallContactPolicy() {
  const { t } = useTranslation();
  const { currentData: data, isError } = useGetCompanyCallPolicyQuery();
  const [save, { isLoading }] = useSetCompanyCallPolicyMutation();
  const [hours, setHours] = useState('24'),
    [failed, setFailed] = useState(false);
  const persistedHours = data?.windowHours;
  useEffect(() => {
    if (persistedHours !== undefined) setHours(String(persistedHours));
  }, [persistedHours]);
  if (isError)
    return <Text variant="muted">{t('calls.contactPolicyReadError')}</Text>;
  if (!data?.canEdit) return null;
  const valid =
    /^\d+$/.test(hours) && Number(hours) >= 1 && Number(hours) <= 168;
  return (
    <details className={cls.contactSettings}>
      <summary>{t('calls.contactPolicyTitle')}</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setFailed(false);
          try {
            await save({ windowHours: Number(hours) }).unwrap();
          } catch {
            setFailed(true);
          }
        }}
      >
        <VStack gap="12" align="stretch">
          <Flex gap="4" align="center"><Label htmlFor="calls-contact-hours">
            {t('calls.contactPolicyHours')}
          </Label><InfoTooltip text={t('calls.contactPolicyMeaning')}/></Flex>
          <Input
            id="calls-contact-hours"
            type="number"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          {failed && <Text role="alert">{t('calls.contactPolicyError')}</Text>}
          <Button
            type="submit"
            disabled={isLoading || !valid || Number(hours) === data.windowHours}
          >
            {t('calls.contactPolicySave')}
          </Button>
        </VStack>
      </form>
    </details>
  );
}
