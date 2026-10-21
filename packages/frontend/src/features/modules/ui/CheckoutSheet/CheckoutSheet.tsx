import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NavItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useGetMyBalanceQuery, usePurchaseModuleMutation, usePurchaseAiSkuMutation } from '@/shared/api/endpoints/cloudAdminApi';
import { useSetProductActivationMutation } from '@/shared/api/endpoints/integrationsApi';
import { isAiProductCode } from '@/features/modules/lib/aiProductCodes';
import cls from './CheckoutSheet.module.scss';

export type CheckoutStep = 'review' | 'success';
export type CheckoutKind = 'hub-module' | 'ai-sku';

export interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleCode: string;
  moduleName: string;
  priceRub: number;
  checkoutKind?: CheckoutKind;
  entryPath?: string;
  includes?: string[];
  onPurchased?: (code: string) => void;
}

function isInsufficientBalanceError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
    ?? (err as { data?: { statusCode?: number } })?.data?.statusCode;
  const code = (err as { data?: { code?: string } })?.data?.code;
  return status === 402 || code === 'INSUFFICIENT_BALANCE';
}

function shortfallRub(err: unknown): number | null {
  const data = (err as { data?: { availableKopecks?: number; neededKopecks?: number } })?.data;
  if (typeof data?.neededKopecks !== 'number' || typeof data.availableKopecks !== 'number') return null;
  return Math.max(0, Math.ceil((data.neededKopecks - data.availableKopecks) / 100));
}

/**
 * One-step connect: price, balance, optional immediate enable, then open the module.
 */
export function CheckoutSheet({
  open,
  onOpenChange,
  moduleCode,
  moduleName,
  priceRub,
  checkoutKind = 'hub-module',
  entryPath,
  includes = [],
  onPurchased,
}: CheckoutSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<CheckoutStep>('review');
  const [enableNow, setEnableNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [purchaseModule, moduleState] = usePurchaseModuleMutation();
  const [purchaseAiSku, skuState] = usePurchaseAiSkuMutation();
  const [setActivation, activationState] = useSetProductActivationMutation();
  const isSku = checkoutKind === 'ai-sku';
  const { data: balance } = useGetMyBalanceQuery(undefined, { skip: !open });
  const isLoading = moduleState.isLoading || skuState.isLoading || activationState.isLoading;
  const availableRub = balance
    ? Number(balance.balance_rub) + Number(balance.credit_limit_kopecks) / 100
    : null;
  const previewShort = availableRub != null && priceRub > availableRub
    ? Math.ceil(priceRub - availableRub)
    : 0;

  useEffect(() => {
    if (open) {
      setStep('review');
      setEnableNow(true);
      setError(null);
      setShortfall(null);
      setInsufficient(false);
    }
  }, [open, moduleCode]);

  const handleConfirm = async () => {
    setError(null);
    setShortfall(null);
    setInsufficient(false);
    try {
      if (isSku) {
        await purchaseAiSku({ skuCode: moduleCode }).unwrap();
        if (enableNow && isAiProductCode(moduleCode)) {
          try {
            await setActivation({ code: moduleCode, enabled: true }).unwrap();
          } catch {
            setError(t('marketplace.enableFailed'));
            return;
          }
        }
      } else {
        await purchaseModule({ moduleCode }).unwrap();
      }
      onPurchased?.(moduleCode);
      setStep('success');
    } catch (err) {
      if (isInsufficientBalanceError(err)) {
        setShortfall(shortfallRub(err));
        setInsufficient(true);
        setError(t('marketplace.insufficientBalance'));
      } else {
        const code = (err as { data?: { code?: string } })?.data?.code;
        setError(code === 'OFFER_NOT_RELEASED'
          ? t('marketplace.skuUnpublished')
          : t('marketplace.checkoutError'));
      }
    }
  };

  const priceLabel = priceRub > 0
    ? t('marketplace.priceMonthly', { amount: priceRub })
    : t('marketplace.priceFree');
  const missing = shortfall ?? (previewShort > 0 ? previewShort : 0);

  const body = (
    <VStack gap="16" max data-testid="checkout-sheet" data-step={step}>
      {step === 'review' && (
        <VStack gap="8" max data-testid="checkout-step-plan">
          <Text as="h3">{moduleName}</Text>
          <Text className={cls.price}>{priceLabel}</Text>
          {includes.length > 0 && (
            <VStack gap="4" max>
              <Text variant="muted">{t('hub.includes')}</Text>
              {includes.map((name) => <Text key={name}>{name}</Text>)}
            </VStack>
          )}
          {availableRub != null && (
            <VStack gap="2">
              <Text>{t('marketplace.balanceNow', { amount: Math.round(availableRub) })}</Text>
              <Text variant="muted">{t('marketplace.balanceAfter', { amount: Math.round(availableRub - priceRub) })}</Text>
            </VStack>
          )}
          {isSku && (
            <HStack gap="8" align="center">
              <Switch
                checked={enableNow}
                onCheckedChange={setEnableNow}
                id="checkout-enable-now"
                aria-label={t('marketplace.enableNow')}
              />
              <Text as="span">{t('marketplace.enableNow')}</Text>
            </HStack>
          )}
          {missing > 0 && (
            <Text role="alert" data-testid="checkout-shortfall">
              {t('marketplace.shortfall', { amount: missing })}
            </Text>
          )}
          {error ? (
            <Text className={cls.error} role="alert" data-testid="checkout-error">{error}</Text>
          ) : null}
          {missing > 0 || insufficient ? (
            <Text className={cls.depositHint} data-testid="checkout-deposit-hint">{t('marketplace.topUpHint')}</Text>
          ) : null}
        </VStack>
      )}
      {step === 'success' && (
        <VStack gap="8" max data-testid="checkout-step-success">
          <Text>{t(isSku ? 'marketplace.checkoutSuccessSku' : 'marketplace.checkoutSuccess', { name: moduleName })}</Text>
        </VStack>
      )}
    </VStack>
  );

  const footer = step === 'review' ? (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel', 'Cancel')}</Button>
      <Button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={isLoading || previewShort > 0}
        data-testid="checkout-confirm"
      >
        {priceRub > 0 ? t('marketplace.connectFor', { amount: priceRub }) : t('marketplace.buy')}
      </Button>
    </>
  ) : entryPath ? (
    <NavItem to={entryPath} data-testid="checkout-open" onClick={() => onOpenChange(false)}>
      {t('marketplace.openModule')}
    </NavItem>
  ) : (
    <Button type="button" onClick={() => onOpenChange(false)} data-testid="checkout-done">{t('marketplace.checkoutDone')}</Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent data-testid="checkout-surface-sheet">
          <SheetHeader>
            <SheetTitle>{t('marketplace.checkoutTitle')}</SheetTitle>
            <SheetDescription>{moduleName}</SheetDescription>
          </SheetHeader>
          {body}
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="checkout-surface-dialog">
        <DialogHeader>
          <DialogTitle>{t('marketplace.checkoutTitle')}</DialogTitle>
          <DialogDescription>{moduleName}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
