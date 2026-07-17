import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Key, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Button, Input } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectEndpointCredentialsSipId } from '../../model/selectors/endpointsPageSelectors';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useGetEndpointCredentialsQuery } from '@/shared/api/endpoints/endpointApi';

export const SipCredentialsModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sipId = useAppSelector(selectEndpointCredentialsSipId);
  
  const { data: creds, isLoading } = useGetEndpointCredentialsQuery(sipId!, {
    skip: !sipId,
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeCredentialsModal());
    setTimeout(() => setCopiedField(null), 300);
  }, [dispatch]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    if (!creds) return;
    let text = `SIP Server: ${creds.domain}\nUsername: ${creds.username}\nPassword: ${creds.password}`;
    if (creds.webrtc) {
      text += `\n\nWebRTC Username: ${creds.webrtc.username}\nWebRTC Password: ${creds.webrtc.password}\nWebRTC Transport: WSS`;
    }
    copyToClipboard(text, 'all');
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
          <Flex gap="8">
            <Input readOnly value={value} className="font-mono bg-background/50" />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => copyToClipboard(value, field)}
            >
              {copiedField === field ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </Flex>
        </VStack>
      ))}
    </VStack>
  );

  return (
    <Dialog.Root open={!!sipId} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-6 z-50 shadow-2xl max-h-[90vh] overflow-y-auto">
          <HStack justify="between" align="center" className="mb-6">
            <HStack gap="8" align="center">
              <Key className="w-5 h-5 text-primary" />
              <Dialog.Title className="text-xl font-bold">
                {t('endpoints.sipCredentials', 'Данные для подключения')}
              </Dialog.Title>
            </HStack>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </HStack>

          {isLoading ? (
            <VStack gap="16" className="py-8 justify-center items-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">{t('common.loading', 'Загрузка...')}</p>
            </VStack>
          ) : creds ? (
            <VStack gap="16">
              {renderCredBlock(t('endpoints.credSip', 'Телефон / SIP'), [
                { label: 'SIP Server / Domain', value: creds.domain, field: 'domain' },
                { label: 'Username / Login', value: creds.username, field: 'username' },
                { label: 'Password', value: creds.password, field: 'password' },
              ])}

              {creds.webrtc && renderCredBlock(t('endpoints.credWebrtc', 'WebRTC'), [
                { label: 'SIP Server / Domain', value: creds.webrtc.domain, field: 'w-domain' },
                { label: 'Username / Login', value: creds.webrtc.username, field: 'w-username' },
                { label: 'Password', value: creds.webrtc.password, field: 'w-password' },
                { label: 'Transport', value: 'WSS', field: 'w-transport' },
              ])}

              <HStack gap="8" justify="end" className="mt-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={handleClose}>
                  {t('common.close', 'Закрыть')}
                </Button>
                <Button onClick={copyAll} className="gap-2">
                  {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {t('endpoints.copyAll', 'Скопировать всё')}
                </Button>
              </HStack>
            </VStack>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Нет данных для подключения
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
