import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui';
import { CallCardForm } from '../CallCardForm';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';

export interface CallCardPopupProps {
  open: boolean;
  template: ICardTemplate | null;
  initialValues: Record<string, unknown>;
  callContext: CallCardContext | null;
  isVip: boolean;
  wrapupRemaining?: number;
  onClose: () => void;
}

/** Sheet variant of the call card (the agent workspace renders {@link CallCardForm} inline instead). */
export const CallCardPopup = memo(({
  open,
  template,
  initialValues,
  callContext,
  isVip,
  wrapupRemaining,
  onClose,
}: CallCardPopupProps) => {
  const { t } = useTranslation();
  if (!template) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('callcenter.cards.popup.title')}</SheetTitle>
        </SheetHeader>
        <CallCardForm
          template={template}
          initialValues={initialValues}
          callContext={callContext}
          isVip={isVip}
          wrapupRemaining={wrapupRemaining}
          onClose={onClose}
        />
      </SheetContent>
    </Sheet>
  );
});

CallCardPopup.displayName = 'CallCardPopup';
