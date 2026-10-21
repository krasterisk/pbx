import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserLevel } from '@krasterisk/shared';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import type { HubModuleRow } from '@/features/modules/types';
import { canPurchaseModules } from '@/features/modules/lib/moduleAccess';
import { resolveHubDisplayPrice } from '@/features/modules/lib/hubMarketPrices';
import { isAiProductCode } from '@/features/modules/lib/aiProductCodes';
import { useGetAiSkuCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import cls from './ModuleHub.module.scss';

interface ModuleHubMarketplaceCardProps {
  row: HubModuleRow;
  index: number;
  reduceMotion: boolean;
  onOpen: () => void;
}

export const ModuleHubMarketplaceCard = memo(function ModuleHubMarketplaceCard({
  row, onOpen,
}: ModuleHubMarketplaceCardProps) {
  const { t } = useTranslation();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const canBuy = canPurchaseModules(level);
  const Icon = row.pages[0]?.icon;
  const name = t(row.labelKey);
  const isAi = isAiProductCode(row.code);
  const { data: skus } = useGetAiSkuCatalogQuery(undefined, { skip: !isAi });
  const publishedSku = useMemo(
    () => (skus ?? []).find((sku) => sku.skuCode === row.code || sku.product === row.code),
    [skus, row.code],
  );
  const priceRub = isAi
    ? Math.round((publishedSku?.priceMonthlyMinor ?? 0) / 100)
    : resolveHubDisplayPrice(row);
  const publishedReady = !isAi || !!publishedSku;

  return (
    <>
      <Flex max>
        <HStack gap="12" align="center" max className={cls.marketCard}>
          <Flex className={cls.iconBadge} align="center" justify="center">
            {Icon ? <Icon size={18} aria-hidden /> : null}
          </Flex>

          <VStack gap="2" className={cls.rowDescription}>
            <Text as="span" className={cls.moduleName}>
              {name}
            </Text>
            <Text variant="muted">
              {t('hub.kindMarket', 'Extension')}
              {priceRub > 0 ? ` · ${t('marketplace.priceMonthly', { amount: priceRub })}` : ''}
            </Text>
          </VStack>

          <Badge className={cls.pillLock}>{t('license.locked')}</Badge>

          {canBuy ? (
            <Button
              type="button"
              size="sm"
              onClick={onOpen}
              disabled={!publishedReady}
              id={`hub-buy-${row.code}`}
            >
              {publishedReady ? t('marketplace.buy') : t('marketplace.skuUnpublished')}
            </Button>
          ) : (
            <Text variant="muted">{t('hub.askAdmin')}</Text>
          )}
        </HStack>
      </Flex>
    </>
  );
});
