import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug } from 'lucide-react';
import {
  Button, Card, CardContent, Dialog, DialogContent, DialogTitle, Input, Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useCreateIntegrationMutation,
  useGetIntegrationsQuery,
  useRevokeIntegrationMutation,
  useRotateIntegrationMutation,
  type AiProductCode,
} from '@/shared/api/endpoints/integrationsApi';
import cls from '../AiProductLandingPage/AiProductLandingPage.module.scss';

function queryErrorKind(error: unknown): 'forbidden' | 'unavailable' | 'error' {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number | string }).status;
    if (status === 403) return 'forbidden';
    if (status === 503) return 'unavailable';
  }
  return 'error';
}

function downloadSecret(token: string) {
  const blob = new Blob([token], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'integration-token.txt';
  link.click();
  URL.revokeObjectURL(url);
}

export const AiConnectionsPage = memo(({ product }: { product: AiProductCode }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useGetIntegrationsQuery({ product });
  const [create, createState] = useCreateIntegrationMutation();
  const [rotate, rotateState] = useRotateIntegrationMutation();
  const [revoke, revokeState] = useRevokeIntegrationMutation();
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [replayLost, setReplayLost] = useState(false);

  const busy = createState.isLoading || rotateState.isLoading || revokeState.isLoading;
  const items = data?.items ?? [];
  const errorKind = isError ? queryErrorKind(error) : null;

  const showSecret = (token: string | null) => {
    if (token) {
      setReplayLost(false);
      setSecret(token);
      return;
    }
    setSecret(null);
    setReplayLost(true);
  };

  return (
    <VStack gap="24" max className={cls.page} data-testid={`ai-connections-${product}`}>
      <HStack gap="12" align="center">
        <Flex align="center" justify="center" className={cls.iconBadge}>
          <Plug size={24} />
        </Flex>
        <VStack gap="4">
          <Text variant="h1" as="h1">{t('aiProducts.connections.title')}</Text>
          <Text variant="muted">{t(`aiProducts.connections.subtitle.${product}`)}</Text>
        </VStack>
      </HStack>
      {isLoading && <Text variant="muted">{t('aiProducts.connections.loading')}</Text>}
      {errorKind && (
        <Text variant="error">{t(`aiProducts.connections.${errorKind}`)}</Text>
      )}
      {!isLoading && !errorKind && items.length === 0 && (
        <Text variant="muted">{t(`aiProducts.connections.empty.${product}`)}</Text>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Flex justify="between" align="center" max>
              <VStack gap="4">
                <Text>{item.label}</Text>
                <Text variant="muted">
                  {item.status} · {item.product} · rev {item.permissionRevision}
                  {item.generation != null ? ` · gen ${item.generation}` : ''}
                </Text>
              </VStack>
              <HStack gap="8">
                <Button
                  variant="outline"
                  disabled={busy || item.generation == null}
                  onClick={() => {
                    if (item.generation == null) return;
                    if (!window.confirm(t('aiProducts.connections.confirmRotate'))) return;
                    void rotate({
                      id: item.id,
                      expectedGeneration: item.generation,
                      operationId: crypto.randomUUID(),
                    }).unwrap().then((result) => showSecret(result.token)).catch(() => undefined);
                  }}
                >
                  {t('aiProducts.connections.rotate')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(t('aiProducts.connections.confirmRevoke'))) return;
                    void revoke(item.id);
                  }}
                >
                  {t('aiProducts.connections.revoke')}
                </Button>
              </HStack>
            </Flex>
          </CardContent>
        </Card>
      ))}
      <HStack gap="8" align="center">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={t('aiProducts.connections.labelPlaceholder')}
          aria-label={t('aiProducts.connections.labelPlaceholder')}
        />
        <Button
          disabled={busy || label.trim().length === 0}
          onClick={() => {
            void create({
              label: label.trim(), product, operationId: crypto.randomUUID(),
            }).unwrap().then((result) => {
              setLabel('');
              showSecret(result.token);
            }).catch(() => undefined);
          }}
        >
          {t('aiProducts.connections.create')}
        </Button>
      </HStack>
      {replayLost && (
        <Text variant="muted">{t('aiProducts.connections.secretLost')}</Text>
      )}
      <Dialog open={secret != null} onOpenChange={(open) => { if (!open) setSecret(null); }}>
        <DialogContent>
          <DialogTitle>{t('aiProducts.connections.secretTitle')}</DialogTitle>
          {secret ? (
            <VStack gap="12">
              <Text variant="muted">{t('aiProducts.connections.secretWarning')}</Text>
              <Input readOnly value={secret} aria-label={t('aiProducts.connections.secretTitle')} />
              <HStack gap="8">
                <Button onClick={() => void navigator.clipboard.writeText(secret)}>
                  {t('aiProducts.connections.copy')}
                </Button>
                <Button variant="outline" onClick={() => downloadSecret(secret)}>
                  {t('aiProducts.connections.download')}
                </Button>
              </HStack>
            </VStack>
          ) : (
            <Text variant="muted">{t('aiProducts.connections.secretLost')}</Text>
          )}
        </DialogContent>
      </Dialog>
    </VStack>
  );
});

AiConnectionsPage.displayName = 'AiConnectionsPage';
