import { memo, useState } from 'react';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plug, Plus } from 'lucide-react';
import {
  Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
  useGetIntegrationsQuery,
  useRevokeIntegrationMutation,
  useRotateIntegrationMutation,
  type AiProductCode,
  type IntegrationPrincipal,
} from '@/shared/api/endpoints/integrationsApi';
import { ConnectionsApiDocs } from './ConnectionsApiDocs';
import {
  cabinetSaProjects,
  useCreateSaApiTokenMutation,
  useGetSaApiTokensQuery,
  useGetSaProjectsQuery,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';
import cls from './AiConnectionsPage.module.scss';

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

type PendingAction = { item: IntegrationPrincipal; kind: 'rotate' | 'revoke' | 'delete' };

export const AiConnectionsPage = memo(({ product }: { product: AiProductCode }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useGetIntegrationsQuery(
    { product },
    { skip: product === 'speech_analytics' },
  );
  const tokensQuery = useGetSaApiTokensQuery(undefined, { skip: product !== 'speech_analytics' });
  const projectsQuery = useGetSaProjectsQuery(undefined, { skip: product !== 'speech_analytics' });
  const [createToken, createTokenState] = useCreateSaApiTokenMutation();
  const [create, createState] = useCreateIntegrationMutation();
  const [rotate, rotateState] = useRotateIntegrationMutation();
  const [revoke, revokeState] = useRevokeIntegrationMutation();
  const [remove, removeState] = useDeleteIntegrationMutation();
  const [label, setLabel] = useState('');
  const [projectId, setProjectId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [replayLost, setReplayLost] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const busy = createState.isLoading || createTokenState.isLoading || rotateState.isLoading || revokeState.isLoading || removeState.isLoading;
  const speech = product === 'speech_analytics';
  const projects = cabinetSaProjects(projectsQuery.data);
  const projectName = (id: string | null) => projects.find((project) => project.id === id)?.name ?? id;
  const items = speech
    ? (tokensQuery.data ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status,
      product,
      permissionRevision: '',
      generation: item.generation,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      projectId: item.projectId,
    }))
    : (data?.items ?? []).map((item) => ({ ...item, projectId: null as string | null }));
  const loading = speech ? tokensQuery.isLoading : isLoading;
  const failed = speech ? tokensQuery.isError : isError;
  const errorKind = failed ? queryErrorKind(speech ? tokensQuery.error : error) : null;
  const reload = () => { void (speech ? tokensQuery.refetch() : refetch()); };

  const showSecret = (token: string | null) => {
    if (token) {
      setReplayLost(false);
      setSecret(token);
      return;
    }
    setSecret(null);
    setReplayLost(true);
  };

  const statusLabel = (status: string) => (
    status === 'active'
      ? t('aiProducts.connections.statusActive', 'Активен')
      : t('aiProducts.connections.statusDisabled', 'Отозван')
  );

  const runPending = async () => {
    if (!pending) return;
    const { item, kind } = pending;
    try {
      if (kind === 'rotate' && item.generation != null) {
        const result = await rotate({
          id: item.id,
          expectedGeneration: item.generation,
          operationId: crypto.randomUUID(),
        }).unwrap();
        showSecret(result.token);
      } else if (kind === 'revoke') {
        await revoke(item.id).unwrap();
        toast.success(t('aiProducts.connections.statusDisabled', 'Отозван'));
      } else if (kind === 'delete') {
        await remove(item.id).unwrap();
        toast.success(t('aiProducts.connections.deleted', 'Токен удалён'));
      }
      setPending(null);
      reload();
    } catch {
      toast.error(t('aiProducts.connections.error'));
    }
  };

  const openCreate = () => {
    setLabel('');
    setProjectId(projects.find((project) => project.analysisVersionNo)?.id ?? projects[0]?.id ?? '');
    setCreateOpen(true);
  };

  const generateKey = () => {
    if (!projectId || !label.trim()) return;
    void createToken({
      label: label.trim(),
      projectId,
      operationId: crypto.randomUUID(),
    }).unwrap().then((result) => {
      setCreateOpen(false);
      setLabel('');
      showSecret(result.token);
    }).catch(() => toast.error(t('aiProducts.connections.error')));
  };

  const createButton = (
    <Button type="button" onClick={openCreate} disabled={busy}>
      <Plus size={16} />
      {t('aiProducts.connections.create', 'Создать токен')}
    </Button>
  );
  const confirmText = pending?.kind === 'delete'
    ? t('aiProducts.connections.confirmDelete', 'Удалить токен навсегда? Он исчезнет из списка и перестанет работать.')
    : pending?.kind === 'rotate'
      ? t('aiProducts.connections.confirmRotate')
      : t('aiProducts.connections.confirmRevoke');

  return (
    <VStack gap="24" max className={cls.page} data-testid={`ai-connections-${product}`}>
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Plug size={24} />
          </Flex>
          <VStack gap="4">
            <Text variant="h1" as="h1" className={cls.title}>{t('aiProducts.connections.title')}</Text>
            <Text variant="muted">{t(`aiProducts.connections.subtitle.${product}`)}</Text>
          </VStack>
        </HStack>
        {speech && items.length > 0 ? createButton : null}
      </Flex>

      {!speech ? (
      <Card>
        <CardContent>
          <HStack gap="8" align="center" className={cls.createRow}>
            <Input
              className={cls.labelInput}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('aiProducts.connections.labelPlaceholder')}
              aria-label={t('aiProducts.connections.labelPlaceholder')}
            />
            <Button
              disabled={busy || label.trim().length === 0}
              onClick={() => {
                void create({
                  label: label.trim(),
                  product,
                  operationId: crypto.randomUUID(),
                }).unwrap().then((result) => {
                  setLabel('');
                  showSecret(result.token);
                }).catch(() => toast.error(t('aiProducts.connections.error')));
              }}
            >
              {t('aiProducts.connections.create')}
            </Button>
          </HStack>
        </CardContent>
      </Card>
      ) : null}

      {loading ? <Text variant="muted">{t('aiProducts.connections.loading')}</Text> : null}
      {errorKind ? <QueryErrorState message={t(`aiProducts.connections.${errorKind}`)} onRetry={reload} /> : null}
      {!loading && !errorKind && items.length === 0 ? (
        <VStack gap="12" max align="center" className={cls.emptyPanel} data-testid="connections-empty">
          <Text variant="h2" as="h2">
            {t('aiProducts.connections.emptyHeading', 'Токенов пока нет')}
          </Text>
          <Text variant="muted">
            {speech
              ? t('aiProducts.connections.emptyBody', 'Создайте токен и привяжите его к проекту. Разбор пойдёт по опубликованным метрикам этого проекта.')
              : t(`aiProducts.connections.empty.${product}`)}
          </Text>
          {speech ? createButton : null}
        </VStack>
      ) : null}

      {items.map((item) => {
        const active = item.status === 'active';
        return (
          <Card key={item.id} className={cls.keyCard}>
            <CardContent>
              <Flex justify="between" align="center" max>
                <VStack gap="4">
                  <HStack gap="8" align="center">
                    <Text>{item.label}</Text>
                    <Text className={`${cls.badge} ${active ? cls.badgeActive : cls.badgeDisabled}`}>
                      {statusLabel(item.status)}
                    </Text>
                  </HStack>
                  {speech ? (
                    <Text variant="muted">
                      {item.projectId
                        ? `${t('aiProducts.connections.boundProject', 'Проект')}: ${projectName(item.projectId)}`
                        : t('aiProducts.connections.unboundProject', 'Проект не привязан. Создайте новый токен.')}
                    </Text>
                  ) : null}
                  <Text variant="muted">
                    {item.generation != null ? `gen ${item.generation}` : t('aiProducts.connections.statusDisabled', 'Отозван')}
                  </Text>
                </VStack>
                <HStack gap="8">
                  {active && item.generation != null ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setPending({ item, kind: 'rotate' })}
                    >
                      {t('aiProducts.connections.rotate')}
                    </Button>
                  ) : null}
                  {active ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setPending({ item, kind: 'revoke' })}
                    >
                      {t('aiProducts.connections.revoke')}
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setPending({ item, kind: 'delete' })}
                  >
                    {t('aiProducts.connections.delete', 'Удалить')}
                  </Button>
                </HStack>
              </Flex>
            </CardContent>
          </Card>
        );
      })}

      {replayLost ? <Text variant="muted">{t('aiProducts.connections.secretLost')}</Text> : null}
      {product === 'speech_analytics' ? <ConnectionsApiDocs /> : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiProducts.connections.create', 'Создать токен')}</DialogTitle>
          </DialogHeader>
          <VStack gap="12">
            <Text variant="muted">
              {t('aiProducts.connections.createHint', 'Разбор звонков с этим токеном идёт по опубликованным метрикам выбранного проекта.')}
            </Text>
            <VStack gap="4">
              <Label htmlFor="sa-key-name">{t('aiProducts.connections.labelPlaceholder', 'Название токена')}</Label>
              <Input id="sa-key-name" value={label} onChange={(event) => setLabel(event.target.value)} />
            </VStack>
            <VStack gap="4">
              <Label htmlFor="sa-key-project">{t('aiProducts.connections.keyProject', 'Проект')}</Label>
              <Select id="sa-key-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </VStack>
          </VStack>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="button" disabled={busy || !label.trim() || !projectId} onClick={generateKey}>
              {t('aiProducts.connections.generate', 'Сгенерировать')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secret != null} onOpenChange={(open) => { if (!open) setSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiProducts.connections.secretTitle')}</DialogTitle>
          </DialogHeader>
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

      <Dialog open={pending != null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.item.label}</DialogTitle>
          </DialogHeader>
          <Text>{confirmText}</Text>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              type="button"
              variant={pending?.kind === 'rotate' ? 'default' : 'destructive'}
              disabled={busy}
              onClick={() => void runPending()}
            >
              {pending?.kind === 'rotate'
                ? t('aiProducts.connections.rotate')
                : pending?.kind === 'revoke'
                  ? t('aiProducts.connections.revoke')
                  : t('aiProducts.connections.delete', 'Удалить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
});

AiConnectionsPage.displayName = 'AiConnectionsPage';
