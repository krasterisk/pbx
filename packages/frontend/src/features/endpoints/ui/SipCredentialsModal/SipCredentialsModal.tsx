import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Key, Copy, Check } from 'lucide-react';
import { useState, useCallback, useRef, type MouseEvent } from 'react';
import { Button, Input } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectEndpointCredentialsSipId } from '../../model/selectors/endpointsPageSelectors';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';

/**
 * Clipboard API rejects writes inside a modal dialog ("Document is not focused")
 * and is missing on plain HTTP. Selection copy stays inside the dialog so the
 * focus trap does not clear it.
 */
async function copyText(text: string, container: HTMLElement | null): Promise<boolean> {
  // Start the async write during the click, then copy synchronously as well.
  // A modal often rejects the Clipboard API after the first await.
  let pending: Promise<void> | null = null;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      pending = navigator.clipboard.writeText(text);
    }
  } catch {
    pending = null;
  }
  const selectionOk = copyWithSelection(text, container);
  if (!pending) return selectionOk;
  try {
    await pending;
    return true;
  } catch {
    return selectionOk;
  }
}

function copyWithSelection(text: string, container: HTMLElement | null): boolean {
  const host = container ?? document.body;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.tabIndex = -1;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  host.appendChild(textarea);
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  host.removeChild(textarea);
  previous?.focus({ preventScroll: true });
  return ok;
}

function keepDialogFocused(event: MouseEvent<HTMLButtonElement>) {
  // Focusing the button makes Chrome treat the document as unfocused and reject clipboard writes.
  event.preventDefault();
}

export const SipCredentialsModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sipId = useAppSelector(selectEndpointCredentialsSipId);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: creds, isLoading } = useGetEndpointCredentialsQuery(sipId!, {
    skip: !sipId,
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeCredentialsModal());
    setTimeout(() => setCopiedField(null), 300);
  }, [dispatch]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    const ok = await copyText(text, contentRef.current);
    if (!ok) return;
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 2000);
  }, []);

  const copyAll = () => {
    if (!creds) return;
    const sipFields = [
      { label: t('endpoints.credServer'), value: creds.domain },
      { label: t('endpoints.credLogin'), value: creds.username },
      { label: t('endpoints.password'), value: creds.password },
    ];
    const blocks = [
      [t('endpoints.credSip'), ...sipFields.map(({ label, value }) => `${label}: ${value}`)].join('\n'),
    ];
    if (creds.webrtc) {
      const webrtcFields = [
        { label: t('endpoints.credServer'), value: creds.webrtc.domain },
        { label: t('endpoints.credLogin'), value: creds.webrtc.username },
        { label: t('endpoints.password'), value: creds.webrtc.password },
        { label: t('endpoints.transport'), value: (creds.webrtc.transport || 'wss').toUpperCase() },
      ];
      blocks.push(
        [t('endpoints.credWebrtc'), ...webrtcFields.map(({ label, value }) => `${label}: ${value}`)].join('\n'),
      );
    }
    void copyToClipboard(blocks.join('\n\n'), 'all');
  };

  const renderCredBlock = (
    title: string,
    fields: { label: string; value: string; field: string }[],
  ) => (
    <VStack gap="12" className="border border-border rounded-xl p-4 bg-background/40">
      <p className="text-sm font-semibold">{title}</p>
      {fields.map(({ label, value, field }) => (
        <VStack gap="4" key={field}>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
          <Flex gap="8" max>
            <Input readOnly value={value} className="min-w-0 flex-1 font-mono bg-background/50" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={t('endpoints.copyField', { field: label })}
              onMouseDown={keepDialogFocused}
              onClick={() => { void copyToClipboard(value, field); }}
            >
              {copiedField === field ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </Flex>
        </VStack>
      ))}
    </VStack>
  );

  const sipFields = creds
    ? [
        { label: t('endpoints.credServer'), value: creds.domain, field: 'domain' },
        { label: t('endpoints.credLogin'), value: creds.username, field: 'username' },
        { label: t('endpoints.password'), value: creds.password, field: 'password' },
      ]
    : [];

  const webrtcFields = creds?.webrtc
    ? [
        { label: t('endpoints.credServer'), value: creds.webrtc.domain, field: 'w-domain' },
        { label: t('endpoints.credLogin'), value: creds.webrtc.username, field: 'w-username' },
        { label: t('endpoints.password'), value: creds.webrtc.password, field: 'w-password' },
        {
          label: t('endpoints.transport'),
          value: (creds.webrtc.transport || 'wss').toUpperCase(),
          field: 'w-transport',
        },
      ]
    : [];

  return (
    <Dialog.Root open={!!sipId} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-6 z-50 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <HStack justify="between" align="center" className="mb-6">
            <HStack gap="8" align="center">
              <Key className="w-5 h-5 text-primary" />
              <Dialog.Title className="text-xl font-bold">
                {t('endpoints.sipCredentials')}
              </Dialog.Title>
            </HStack>
            <Dialog.Close asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={t('common.close')}>
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </HStack>

          {isLoading ? (
            <VStack gap="16" className="py-8 justify-center items-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            </VStack>
          ) : creds ? (
            <VStack gap="16">
              {renderCredBlock(t('endpoints.credSip'), sipFields)}

              {creds.webrtc && renderCredBlock(t('endpoints.credWebrtc'), webrtcFields)}

              <HStack gap="8" justify="end" className="mt-2 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t('common.close')}
                </Button>
                <Button type="button" onMouseDown={keepDialogFocused} onClick={copyAll} className="gap-2">
                  {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {t('endpoints.copyAll')}
                </Button>
              </HStack>
            </VStack>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('endpoints.credEmpty')}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
