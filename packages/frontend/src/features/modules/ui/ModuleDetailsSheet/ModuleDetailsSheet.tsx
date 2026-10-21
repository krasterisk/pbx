import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserLevel } from '@krasterisk/shared';
import {
  Badge, Button, NavItem, Sheet, SheetContent, SheetHeader, SheetTitle, Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { canPurchaseModules, accessExpiryDate } from '@/features/modules/lib/moduleAccess';
import { resolveHubDisplayPrice } from '@/features/modules/lib/hubMarketPrices';
import { isAiProductCode } from '@/features/modules/lib/aiProductCodes';
import { useDisableHubModuleMutation, useEnableHubModuleMutation, useGetAiSkuCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useModuleDestination } from '@/features/modules/hooks/useNavigationHistory';
import { CheckoutSheet } from '@/features/modules/ui/CheckoutSheet/CheckoutSheet';
import type { HubModuleRow } from '@/features/modules/types';

export function ModuleDetailsSheet({ row, open, onOpenChange }: {
  row: HubModuleRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const level = useAppSelector((s) => s.auth.user?.level) as UserLevel | undefined;
  const canAdmin = canPurchaseModules(level);
  const { markFresh } = useHubModules();
  const getDestination = useModuleDestination(level);
  const [checkout, setCheckout] = useState(false);
  const [enableModule, enableState] = useEnableHubModuleMutation();
  const [disableModule, disableState] = useDisableHubModuleMutation();
  const isAi = !!row && isAiProductCode(row.code);
  const { data: skus } = useGetAiSkuCatalogQuery(undefined, { skip: !open || !isAi });
  if (!row) return null;
  const name = t(row.labelKey);
  const priceRub = isAi
    ? Math.round(((skus ?? []).find((sku) => sku.skuCode === row.code || sku.product === row.code)?.priceMonthlyMinor ?? 0) / 100)
    : resolveHubDisplayPrice(row);
  const expiry = canAdmin ? accessExpiryDate(row.accessUntil) : null;
  const busy = enableState.isLoading || disableState.isLoading;
  const status = row.licenseStatus === 'locked'
    ? t('license.locked')
    : row.licenseStatus === 'disabled'
      ? t('hub.disabledByAdmin')
      : t('license.active');

  const turnOff = async () => {
    if (!window.confirm(t('hub.disableConfirm'))) return;
    await disableModule(row.code);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} data-testid="module-details">
          <SheetHeader>
            <SheetTitle>{name}</SheetTitle>
          </SheetHeader>
          <VStack gap="12" max>
            <HStack gap="8">
              <Badge>{status}</Badge>
              <Text variant="muted">{t(row.kind === 'base' ? 'hub.kindBase' : 'hub.kindMarket')}</Text>
              {expiry && <Text>{t('hub.until', { date: expiry })}</Text>}
            </HStack>
            {row.description ? <Text>{row.description}</Text> : null}
            {priceRub > 0 && row.licenseStatus === 'locked' && (
              <Text>{t('marketplace.priceMonthly', { amount: priceRub })}</Text>
            )}
            <Text variant="muted">{t('hub.includes')}</Text>
            {row.pages.map((page) => <Text key={page.id}>{t(page.labelKey)}</Text>)}
            <HStack gap="8">
              {row.licenseStatus === 'active' && (
                <NavItem to={getDestination(row)} onClick={() => onOpenChange(false)}>{t('hub.open')}</NavItem>
              )}
              {row.licenseStatus === 'locked' && canAdmin && (
                <Button type="button" onClick={() => setCheckout(true)} data-testid="module-details-buy">{t('marketplace.buy')}</Button>
              )}
              {row.licenseStatus === 'locked' && !canAdmin && <Text variant="muted">{t('hub.askAdmin')}</Text>}
              {row.licenseStatus === 'disabled' && canAdmin && (
                <Button type="button" onClick={() => void enableModule(row.code).unwrap().then(() => markFresh?.(row.code))} disabled={busy}>{t('hub.enable')}</Button>
              )}
              {row.licenseStatus === 'disabled' && !canAdmin && <Text variant="muted">{t('hub.turnedOff')}</Text>}
              {row.licenseStatus === 'active' && canAdmin && row.kind !== 'base' && (
                <Button type="button" variant="outline" onClick={() => void turnOff()} disabled={busy}>{t('hub.disable')}</Button>
              )}
            </HStack>
          </VStack>
        </SheetContent>
      </Sheet>
      <CheckoutSheet
        open={checkout}
        onOpenChange={setCheckout}
        moduleCode={row.code}
        moduleName={name}
        priceRub={priceRub}
        checkoutKind={isAi ? 'ai-sku' : 'hub-module'}
        entryPath={row.pages[0]?.path}
        includes={row.pages.map((page) => t(page.labelKey))}
        onPurchased={(code) => { markFresh?.(code); onOpenChange(false); }}
      />
    </>
  );
}
