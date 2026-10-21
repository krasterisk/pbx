import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@/shared/ui';
import { useAutodialDialogFocus } from './useAutodialDialogFocus';

/** Keep confirmations in the accessible application dialog stack, including nested forms. */
export function useAutodialConfirmation() {
  const { t } = useTranslation();
  const dialogFocus = useAutodialDialogFocus();
  const messageId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const finish = useCallback((accepted: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setMessage(null);
    resolve?.(accepted);
  }, []);
  const confirm = useCallback((text: string): Promise<boolean> => {
    // Repeated clicks must not replace the first pending decision or execute twice.
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => { pending.current = resolve; setMessage(text); });
  }, []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const confirmationDialog = <Dialog open={message !== null} onOpenChange={(open) => { if (!open) finish(false); }}>
    <DialogContent aria-describedby={messageId} {...dialogFocus}>
      <DialogHeader><DialogTitle>{t('common.confirm')}</DialogTitle></DialogHeader>
      <Text id={messageId}>{message}</Text>
      <DialogFooter>
        <Button variant="outline" onClick={() => finish(false)}>{t('common.cancel')}</Button>
        <Button onClick={() => finish(true)}>{t('common.confirm')}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
  return { confirm, confirmationDialog };
}
