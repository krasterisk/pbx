import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import type { HubModuleRow } from '@/features/modules/types';
import { CheckoutSheet } from '@/features/modules/ui/CheckoutSheet';
import { resolveHubDisplayPrice } from '@/features/modules/lib/hubMarketPrices';
import { isAiProductCode } from '@/features/modules/lib/aiProductCodes';
import { useGetAiSkuCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import cls from './ModuleHub.module.scss';

interface ModuleHubMarketplaceCardProps {
  row: HubModuleRow;
  index: number;
  reduceMotion: boolean;
}

export const ModuleHubMarketplaceCard = memo(function ModuleHubMarketplaceCard({
  row,
}: ModuleHubMarketplaceCardProps) {
  const { t } = useTranslation();
  const Icon = row.pages[0]?.icon;
  const name = t(row.labelKey);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const isAi = isAiProductCode(row.code);
  const { data: skus } = useGetAiSkuCatalogQuery(undefined, { skip: !isAi });
  const publishedSku = useMemo(
    () => (skus ?? []).find((sku) => sku.skuCode === row.code || sku.product === row.code),
    [skus, row.code],
  );
  const priceRub = isAi
    ? Math.round((publishedSku?.priceMonthlyMinor ?? 0) / 100)
    : resolveHubDisplayPrice(row);
  const canBuy = !isAi || !!publishedSku;

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

          <Button
            type="button"
            size="sm"
            onClick={() => setCheckoutOpen(true)}
            disabled={!canBuy}
            id={`hub-buy-${row.code}`}
          >
            {canBuy ? t('marketplace.buy') : t('marketplace.skuUnpublished')}
          </Button>
        </HStack>
      </Flex>

      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        moduleCode={publishedSku?.skuCode ?? row.code}
        moduleName={name}
        priceRub={priceRub}
        checkoutKind={isAi ? 'ai-sku' : 'hub-module'}
      />
    </>
  );
});
