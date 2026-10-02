import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, Label, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectIsSuperAdmin } from '@/entities/User';
import {
  useGetRegistrationPolicyQuery,
  useUpdateRegistrationPolicyMutation,
} from '@/shared/api/endpoints/authApi';
import cls from './RegistrationPolicyCard.module.scss';

/** Platform switch: public organization signup. Superadmin only. */
export const RegistrationPolicyCard = memo(() => {
  const { t } = useTranslation();
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const { data, isLoading } = useGetRegistrationPolicyQuery(undefined, { skip: !isSuperAdmin });
  const [update, { isLoading: isSaving }] = useUpdateRegistrationPolicyMutation();

  if (!isSuperAdmin) return null;

  if (isLoading) {
    return (
      <HStack justify="center" align="center" className={cls.loading}>
        <Loader2 className={cls.spinner} />
      </HStack>
    );
  }

  const enabled = data?.registrationEnabled === true;

  const onCheckedChange = (checked: boolean) => {
    void update({ registrationEnabled: checked })
      .unwrap()
      .catch(() => {
        toast.error(t('platform.registrationSaveError'));
      });
  };

  return (
    <Card data-testid="registration-policy-card">
      <CardHeader>
        <HStack gap="12" align="center">
          <VStack align="center" justify="center" className={cls.icon}>
            <UserPlus className={cls.iconSvg} />
          </VStack>
          <VStack gap="2">
            <Text variant="h4">{t('platform.registrationTitle')}</Text>
            <Text variant="muted">{t('platform.registrationHint')}</Text>
          </VStack>
        </HStack>
      </CardHeader>
      <CardContent>
        <HStack justify="between" align="center" className={cls.togglePanel}>
          <Label htmlFor="registration-enabled">{t('platform.registrationToggle')}</Label>
          <Switch
            id="registration-enabled"
            data-testid="registration-enabled"
            checked={enabled}
            disabled={isSaving}
            aria-label={t('platform.registrationToggle')}
            onCheckedChange={onCheckedChange}
          />
        </HStack>
      </CardContent>
    </Card>
  );
});

RegistrationPolicyCard.displayName = 'RegistrationPolicyCard';
