import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import cls from './PlatformPages.module.scss';

/**
 * Scaffold for platform Hub catalog (filled by 08-05 Task 2 PlatformCatalogEditor).
 */
export const PlatformModulesPage = () => {
  const { t } = useTranslation();

  return (
    <VStack gap="12" max data-testid="platform-modules-page">
      <Text as="h1" className={cls.pageTitle}>
        {t('platform.modulesTitle', 'Modules catalog')}
      </Text>
      <Text variant="muted">{t('platform.modulesScaffold', 'Catalog editor loading…')}</Text>
    </VStack>
  );
};
