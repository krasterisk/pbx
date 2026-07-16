import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import cls from './PlatformPages.module.scss';

/**
 * Scaffold for platform role→start matrix (filled by 08-05 Task 2 PlatformRoleStartEditor).
 */
export const PlatformRoleStartPage = () => {
  const { t } = useTranslation();

  return (
    <VStack gap="12" max data-testid="platform-role-start-page">
      <Text as="h1" className={cls.pageTitle}>
        {t('platform.roleStartTitle', 'Role → start')}
      </Text>
      <Text variant="muted">{t('platform.roleStartScaffold', 'Role→start editor loading…')}</Text>
    </VStack>
  );
};
