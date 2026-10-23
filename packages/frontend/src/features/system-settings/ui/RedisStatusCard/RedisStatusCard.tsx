import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Text, Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLazyGetRedisStatusQuery } from '../../api/systemSettingsApi';
import cls from '../SettingsControls.module.scss';

export const RedisStatusCard = memo(() => {
  const { t } = useTranslation();
  const [trigger, { data, isFetching, isUninitialized, isError }] = useLazyGetRedisStatusQuery();
  return <HStack gap="12" wrap="wrap" align="center" justify="between" className={cls.form}>
    <VStack gap="6" className={cls.grow}>
      {isFetching ? <Text variant="muted" role="status">{t('systemSettings.redisChecking')}</Text>
        : isError ? <Text variant="error" role="alert">{t('systemSettings.statusCheckError')}</Text>
          : !isUninitialized && data ? <>
            <Text variant={data.connected ? 'success' : 'error'} role="status">{t(data.connected ? 'systemSettings.redisConnected' : 'systemSettings.redisDisconnected')}</Text>
            {data.connected && <HStack gap="12" wrap="wrap">
              {data.version && <Text variant="muted">{t('systemSettings.redisVersion')}: <Text as="code" className={cls.code}>{data.version}</Text></Text>}
              {data.host && <Text as="code" variant="muted" className={cls.code}>{data.host}:{data.port}</Text>}
            </HStack>}
            {!data.connected && data.message && <Text variant="error">{data.message}</Text>}
          </> : <Text variant="muted">{t('systemSettings.statusNotChecked')}</Text>}
    </VStack>
    <Button size="sm" variant="outline" onClick={() => trigger()} disabled={isFetching} className={cls.action}>
      <RefreshCw className={`${cls.icon} ${isFetching ? cls.spin : ''}`} />{t(isFetching ? 'systemSettings.redisChecking' : 'systemSettings.redisCheck')}
    </Button>
  </HStack>;
});
RedisStatusCard.displayName = 'RedisStatusCard';
