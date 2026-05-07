import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Database, CheckCircle2, XCircle, RefreshCw, Wifi } from 'lucide-react';
import { Text, Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLazyGetRedisStatusQuery } from '@/features/system-settings/api/systemSettingsApi';
import cls from './RedisStatusCard.module.scss';

export const RedisStatusCard = memo(() => {
  const { t } = useTranslation();
  const [trigger, { data, isFetching, isUninitialized }] = useLazyGetRedisStatusQuery();

  return (
    <div className={cls.card}>
      <HStack gap="16" align="center" justify="between" max>
        {/* Status area */}
        <div className={cls.statusArea}>
          <AnimatePresence mode="wait">
            {isUninitialized && !isFetching && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cls.idle}
              >
                <Database className={cls.idleIcon} />
                <Text variant="muted">{t('systemSettings.redisDesc')}</Text>
              </motion.div>
            )}

            {isFetching && (
              <motion.div key="loading" className={cls.idle}>
                <RefreshCw className={`${cls.idleIcon} ${cls.spin}`} />
                <Text variant="muted">{t('systemSettings.redisChecking')}</Text>
              </motion.div>
            )}

            {!isFetching && data && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={data.connected ? cls.resultOk : cls.resultErr}
              >
                {data.connected
                  ? <CheckCircle2 className={cls.iconOk} />
                  : <XCircle className={cls.iconErr} />}
                <VStack gap="2">
                  <Text variant="small" className={data.connected ? cls.textOk : cls.textErr}>
                    {data.connected
                      ? t('systemSettings.redisConnected')
                      : t('systemSettings.redisDisconnected')}
                  </Text>
                  {data.connected && (
                    <HStack gap="12">
                      {data.version && (
                        <Text variant="muted" className={cls.meta}>
                          {t('systemSettings.redisVersion')}: <code className={cls.code}>{data.version}</code>
                        </Text>
                      )}
                      {data.host && (
                        <HStack gap="4" align="center">
                          <Wifi className={cls.metaIcon} />
                          <Text variant="muted" className={cls.meta}>
                            <code className={cls.code}>{data.host}:{data.port}</code>
                          </Text>
                        </HStack>
                      )}
                    </HStack>
                  )}
                  {!data.connected && data.message && (
                    <Text variant="muted" className={cls.errorText}>{data.message}</Text>
                  )}
                </VStack>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Check button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => trigger()}
          disabled={isFetching}
          className={cls.checkBtn}
        >
          <RefreshCw className={`${cls.btnIcon} ${isFetching ? cls.spin : ''}`} />
          {isFetching ? t('systemSettings.redisChecking') : t('systemSettings.redisCheck')}
        </Button>
      </HStack>
    </div>
  );
});

RedisStatusCard.displayName = 'RedisStatusCard';
