import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { BarChart3, Bot, Plug } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label, Loader, Switch, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useGetAiProvidersQuery } from '@/shared/api/endpoints/aiAgentsApi';
import { useGetAiProductsStatusQuery } from '@/shared/api/endpoints/cloudAdminApi';
import {
  useSetProductActivationMutation,
  type AiProductCode,
} from '@/shared/api/endpoints/integrationsApi';
import { resolveAiProductLandingState } from './resolveAiProductLandingState';
import cls from './AiProductLandingPage.module.scss';

const PRODUCTS: Record<AiProductCode, {
  icon: typeof Bot; connections: string; projects?: string; studio?: string; sessions?: string; dashboard?: string;
}> = {
  speech_analytics: {
    icon: BarChart3, connections: '/speech-analytics/connections', projects: '/speech-analytics/projects',
    dashboard: '/speech-analytics/dashboard',
  },
  ai_voice_robots: {
    icon: Bot,
    connections: '/ai-robots/connections',
    studio: '/ai-robots/studio',
    sessions: '/ai-robots/sessions',
  },
};

function activationErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { code?: string } }).data;
    if (typeof data?.code === 'string' && data.code.length > 0) return data.code;
  }
  return 'product_activation_failed';
}

export const AiProductLandingPage = memo(({ product }: { product: AiProductCode }) => {
  const { t } = useTranslation();
  const { active, marketplace, isLoading: hubLoading } = useHubModules();
  const statusQuery = useGetAiProductsStatusQuery();
  const row = [...active, ...marketplace].find((item) => item.code === product);
  const decision = statusQuery.data?.find((item) => item.product === product);
  const { data: providers = [] } = useGetAiProvidersQuery(undefined, {
    skip: hubLoading || statusQuery.isLoading,
  });
  const [setActivation, activationState] = useSetProductActivationMutation();
  const Icon = PRODUCTS[product].icon;
  const licenseStatus = row?.licenseStatus ?? 'locked';
  const loading = hubLoading || statusQuery.isLoading;
  const stateKey = resolveAiProductLandingState({
    loading,
    allowed: decision?.allowed,
    reason: decision?.reason,
    licenseStatus,
    configured: providers.length > 0,
  });
  const canActivate = stateKey === 'disabled'
    || stateKey === 'ready'
    || stateKey === 'notConfigured';
  const enabled = stateKey === 'ready' || stateKey === 'notConfigured';
  const showConnections = stateKey === 'ready'
    || stateKey === 'notConfigured'
    || stateKey === 'disabled'
    || stateKey === 'unavailable';

  return (
    <VStack gap="24" max className={cls.page} data-testid={`ai-product-landing-${product}`}>
      {stateKey === 'pending' ? (
        <Flex align="center" justify="center" className={cls.pending}>
          <Loader size={40} />
        </Flex>
      ) : (
        <>
          <Flex justify="between" align="center" className={cls.header} max>
            <HStack gap="12" align="center">
              <Flex align="center" justify="center" className={cls.iconBadge}>
                <Icon size={24} />
              </Flex>
              <VStack gap="4">
                <Text variant="h1" as="h1">{t(`aiProducts.${product}.title`)}</Text>
                <Text variant="muted">{t(`aiProducts.${product}.subtitle`)}</Text>
              </VStack>
            </HStack>
            <HStack gap="12" align="center">
              <Label htmlFor={`${product}-enabled`}>{t('aiProducts.activation')}</Label>
              <Switch
                id={`${product}-enabled`}
                checked={enabled}
                disabled={activationState.isLoading || !canActivate}
                onCheckedChange={(next) => {
                  void setActivation({ code: product, enabled: next })
                    .unwrap()
                    .catch((error: unknown) => {
                      toast.error(t(`aiProducts.errors.${activationErrorCode(error)}`));
                    });
                }}
              />
            </HStack>
          </Flex>
          <Card>
            <CardHeader>
              <CardTitle>{t(`aiProducts.states.${stateKey}.title`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <VStack gap="12">
                <Text variant="muted">{t(`aiProducts.states.${stateKey}.body`)}</Text>
                {showConnections && (
                  <HStack gap="12">
                    <Button asChild>
                      <Link to={PRODUCTS[product].connections}>
                        <Plug size={16} />
                        {t('aiProducts.openConnections')}
                      </Link>
                    </Button>
                    {PRODUCTS[product].projects ? (
                      <Button asChild variant="outline">
                        <Link to={PRODUCTS[product].projects}>
                          {t('aiProducts.openProjects')}
                        </Link>
                      </Button>
                    ) : null}
                    {PRODUCTS[product].dashboard ? (
                      <Button asChild variant="outline">
                        <Link to={PRODUCTS[product].dashboard}>
                          {t('speechAnalytics.dashboard')}
                        </Link>
                      </Button>
                    ) : null}
                    {PRODUCTS[product].studio ? (
                      <Button asChild variant="outline">
                        <Link to={PRODUCTS[product].studio}>
                          {t('aiProducts.openStudio')}
                        </Link>
                      </Button>
                    ) : null}
                    {PRODUCTS[product].sessions ? (
                      <Button asChild variant="outline">
                        <Link to={PRODUCTS[product].sessions}>
                          {t('aiProducts.openSessions')}
                        </Link>
                      </Button>
                    ) : null}
                  </HStack>
                )}
              </VStack>
            </CardContent>
          </Card>
        </>
      )}
    </VStack>
  );
});

AiProductLandingPage.displayName = 'AiProductLandingPage';
