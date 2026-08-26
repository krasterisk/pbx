import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, Text } from '@/shared/ui';
import { VStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { ModuleHubRow } from './ModuleHubRow';
import { ModuleHubMarketplaceCard } from './ModuleHubMarketplaceCard';
import cls from './ModuleHub.module.scss';

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduce;
}

/**
 * Module Hub - sketch winner 002-E dense single-column list (not bento/dock).
 * Active (active+disabled) then Marketplace (locked + Buy).
 */
export const ModuleHub = memo(function ModuleHub() {
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);
  const level = user?.level as UserLevel | undefined;
  const { active, marketplace, isLoading, toggleFavorite } = useHubModules();
  const reduceMotion = usePrefersReducedMotion();

  if (isLoading) {
    return (
      <Flex className={cls.loaderWrap} align="center" justify="center">
        <Loader size={40} />
      </Flex>
    );
  }

  return (
    <VStack gap="24" className={cls.hub} data-testid="module-hub">
      <Text as="h1" className={cls.title}>
        {t('hub.title')}
      </Text>

      <VStack gap="12" max>
        <Text as="h2" className={cls.sectionLabel}>
          {t('hub.activeSection')}
        </Text>

        {active.length === 0 ? (
          <VStack gap="4" className={cls.empty} align="center">
            <Text variant="h4">{t('hub.emptyActive.title')}</Text>
            <Text variant="muted">{t('hub.emptyActive.body')}</Text>
          </VStack>
        ) : (
          <VStack gap="0" className={cls.list} max data-testid="hub-active-list">
            {active.map((row, index) => (
              <ModuleHubRow
                key={row.code}
                row={row}
                level={level}
                index={index}
                reduceMotion={reduceMotion}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </VStack>
        )}
      </VStack>

      <VStack gap="12" max>
        <Text as="h2" className={cls.sectionLabel}>
          {t('hub.marketplaceSection')}
        </Text>

        {marketplace.length === 0 ? (
          <VStack gap="4" className={cls.empty} align="center">
            <Text variant="h4">{t('marketplace.empty.title')}</Text>
            <Text variant="muted">{t('marketplace.empty.body')}</Text>
          </VStack>
        ) : (
          <VStack gap="12" className={cls.marketList} max data-testid="hub-marketplace-list">
            {marketplace.map((row, index) => (
              <ModuleHubMarketplaceCard
                key={row.code}
                row={row}
                index={index}
                reduceMotion={reduceMotion}
              />
            ))}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
});
