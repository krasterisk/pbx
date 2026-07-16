import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Text,
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { usePurchaseModuleMutation } from '@/shared/api/endpoints/cloudAdminApi';
import cls from './CheckoutSheet.module.scss';

export type CheckoutStep = 'plan' | 'confirm' | 'success';

export interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleCode: string;
  moduleName: string;
  priceRub: number;
}

function isInsufficientBalanceError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
    ?? (err as { data?: { statusCode?: number } })?.data?.statusCode;
  const code = (err as { data?: { code?: string } })?.data?.code;
  return status === 402 || code === 'INSUFFICIENT_BALANCE';
}

/**
 * Marketplace checkout (005-B): plan → confirm → success.
 * Desktop: Dialog; phone: Sheet.
 */
export function CheckoutSheet({
  open,
  onOpenChange,
  moduleCode,
  moduleName,
  priceRub,
}: CheckoutSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<CheckoutStep>('plan');
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [purchaseModule, { isLoading }] = usePurchaseModuleMutation();

  useEffect(() => {
    if (open) {
      setStep('plan');
      setError(null);
      setInsufficient(false);
    }
  }, [open, moduleCode]);

  const handleConfirm = async () => {
    setError(null);
    setInsufficient(false);
    try {
      await purchaseModule({ moduleCode }).unwrap();
      setStep('success');
    } catch (err) {
      if (isInsufficientBalanceError(err)) {
        setInsufficient(true);
        setError(t('marketplace.insufficientBalance'));
      } else {
        setError(t('marketplace.checkoutError'));
      }
    }
  };

  const priceLabel =
    priceRub > 0
      ? t('marketplace.priceMonthly', { amount: priceRub })
      : t('marketplace.priceFree');

  const body = (
    <VStack gap="16" max data-testid="checkout-sheet" data-step={step}>
      <Text className={cls.stepLabel} data-testid="checkout-step-label">
        {step === 'plan' && t('marketplace.checkoutStepPlan')}
        {step === 'confirm' && t('marketplace.checkoutStepConfirm')}
        {step === 'success' && t('marketplace.checkoutStepSuccess')}
      </Text>

      {step === 'plan' && (
        <VStack gap="8" max data-testid="checkout-step-plan">
          <Text as="h3">{moduleName}</Text>
          <Text className={cls.price}>{priceLabel}</Text>
          <Text variant="muted">{t('marketplace.checkoutPlanHint')}</Text>
        </VStack>
      )}

      {step === 'confirm' && (
        <VStack gap="8" max data-testid="checkout-step-confirm">
          <Text>
            {t('marketplace.checkoutConfirmBody', {
              name: moduleName,
              amount: priceRub,
            })}
          </Text>
          {error ? (
            <Text className={cls.error} role="alert" data-testid="checkout-error">
              {error}
            </Text>
          ) : null}
          {insufficient ? (
            <Text className={cls.depositHint} data-testid="checkout-deposit-hint">
              {t('marketplace.insufficientBalanceHint')}{' '}
              <Link to="/system/modules">{t('marketplace.depositLink')}</Link>
            </Text>
          ) : null}
        </VStack>
      )}

      {step === 'success' && (
        <VStack gap="8" max data-testid="checkout-step-success">
          <Text>{t('marketplace.checkoutSuccess', { name: moduleName })}</Text>
        </VStack>
      )}
    </VStack>
  );

  const footer =
    step === 'plan' ? (
      <>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => setStep('confirm')}
          data-testid="checkout-continue"
        >
          {t('marketplace.checkoutContinue')}
        </Button>
      </>
    ) : step === 'confirm' ? (
      <>
        <Button type="button" variant="outline" onClick={() => setStep('plan')} disabled={isLoading}>
          {t('common.back', 'Back')}
        </Button>
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isLoading}
          data-testid="checkout-confirm"
        >
          {t('marketplace.confirmPurchase')}
        </Button>
      </>
    ) : (
      <Button
        type="button"
        onClick={() => onOpenChange(false)}
        data-testid="checkout-done"
      >
        {t('marketplace.checkoutDone')}
      </Button>
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
