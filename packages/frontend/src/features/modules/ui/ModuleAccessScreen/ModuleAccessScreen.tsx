import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { CheckoutSheet } from '@/features/modules/ui/CheckoutSheet/CheckoutSheet';
import { useEnableHubModuleMutation } from '@/shared/api/endpoints/cloudAdminApi';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { resolveHubDisplayPrice } from '@/features/modules/lib/hubMarketPrices';
import type { ModuleRouteBlock } from '@/features/modules/hooks/useModuleLicenseGate';
import cls from './ModuleAccessScreen.module.scss';

export function ModuleAccessScreen({ block }: { block: ModuleRouteBlock }) {
  const { t } = useTranslation();
  const { markFresh } = useHubModules();
  const [checkout, setCheckout] = useState(false);
  const [enableModule, { isLoading }] = useEnableHubModuleMutation();
  const name = t(block.row.labelKey);
  const priceRub = resolveHubDisplayPrice(block.row);
  const { access } = block;

  const enable = async () => {
    await enableModule(block.row.code).unwrap();
    markFresh?.(block.row.code);
  };

  return (
    <Flex align="center" justify="center" className={cls.screen} data-testid="module-access-screen">
      <VStack gap="16" align="center" className={cls.card}>
        <Lock size={28} aria-hidden />
        <Text as="h1">{name}</Text>
        {access.state === 'locked' && (
          <Text variant="muted">{access.canBuy ? t('license.locked') : t('hub.askAdmin')}</Text>
        )}
        {access.state === 'disabled' && (
          <Text variant="muted">{access.canEnable ? t('hub.disabledByAdmin') : t('hub.turnedOff')}</Text>
        )}
        {access.state === 'forbidden' && <Text variant="muted">{t('hub.pageForbidden')}</Text>}
        {block.row.description ? <Text>{block.row.description}</Text> : null}
        {access.state === 'locked' && access.canBuy && (
          <Button type="button" onClick={() => setCheckout(true)} data-testid="module-access-buy">{t('marketplace.buy')}</Button>
        )}
        {access.state === 'disabled' && access.canEnable && (
          <Button type="button" onClick={() => void enable()} disabled={isLoading} data-testid="module-access-enable">{t('hub.enable')}</Button>
        )}
      </VStack>
      <CheckoutSheet
        open={checkout}
        onOpenChange={setCheckout}
        moduleCode={block.row.code}
        moduleName={name}
        priceRub={priceRub}
        checkoutKind={block.checkoutKind}
        entryPath={block.entryPath}
        includes={block.row.pages.map((page) => t(page.labelKey))}
        onPurchased={(code) => markFresh?.(code)}
      />
    </Flex>
  );
}
