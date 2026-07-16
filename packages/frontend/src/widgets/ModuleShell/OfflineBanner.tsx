import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useOfflineBanner } from '@/shared/lib/capacitor/offlineBanner';
import cls from './ModuleShell.module.scss';

/** D-35: banner + retry only — no offline action queue. */
export const OfflineBanner = memo(function OfflineBanner() {
  const { t } = useTranslation();
  const { offline, retry } = useOfflineBanner();

  if (!offline) return null;

  return (
    <HStack
      className={cls.offlineBanner}
      align="center"
      gap="12"
      max
      data-testid="offline-banner"
      role="status"
    >
      <Text as="span" className={cls.offlineBannerText}>
        {t('common.offline')}
      </Text>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="offline-banner-retry"
        onClick={retry}
      >
        {t('common.retry', 'Retry')}
      </Button>
    </HStack>
  );
});
