import { memo, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
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
  const { active, marketplace, isLoading, isError, refetch, toggleFavorite } = useHubModules();
  const reduceMotion = usePrefersReducedMotion();
  const location = useLocation();
  const selectedCode = new URLSearchParams(location.search).get('module');
  const selected = [...active, ...marketplace].find((row) => row.code === selectedCode);
  const focusCode = selected?.code;
  const targetRef = useRef<HTMLDivElement>(null);
  const handledRef = useRef<string | null>(null);
  const interactedRef = useRef(false);
  useEffect(() => {
    interactedRef.current = false;
    const interacted = () => { interactedRef.current = true; };
    window.addEventListener('pointerdown', interacted, true);
    window.addEventListener('keydown', interacted, true);
    return () => { window.removeEventListener('pointerdown', interacted, true); window.removeEventListener('keydown', interacted, true); };
  }, [location.key]);
  useEffect(() => {
    if (isLoading || isError || !focusCode || !targetRef.current) return;
    const key = location.key + ':' + focusCode;
    if (handledRef.current === key) return;
    handledRef.current = key;
    const timer = window.requestAnimationFrame(() => {
      if (interactedRef.current) return;
      targetRef.current?.scrollIntoView?.({ block: 'nearest' });
      targetRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(timer);
  }, [location.key, focusCode, isLoading, isError]);

  if (isError) return <QueryErrorState message={t('common.queryLoadError')} onRetry={refetch} />;
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
              <Flex key={row.code} ref={row.code === selected?.code ? targetRef : undefined} tabIndex={-1}
                data-module-code={row.code} data-selected={row.code === selected?.code ? 'true' : undefined}
                role='group' aria-label={t(row.labelKey)} className={cls.targetRow}>
              <ModuleHubRow
                row={row}
                level={level}
                index={index}
                reduceMotion={reduceMotion}
                onToggleFavorite={toggleFavorite}
              />
              </Flex>
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
              <Flex key={row.code} ref={row.code === selected?.code ? targetRef : undefined} tabIndex={-1}
                data-module-code={row.code} data-selected={row.code === selected?.code ? 'true' : undefined}
                role='group' aria-label={t(row.labelKey)} className={cls.targetRow}>
              <ModuleHubMarketplaceCard
                row={row}
                index={index}
                reduceMotion={reduceMotion}
              />
              </Flex>
            ))}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
});
