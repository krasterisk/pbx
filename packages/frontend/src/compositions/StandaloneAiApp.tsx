import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, Bot, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Text } from '@/shared/ui/Text';
import cls from './StandaloneAiApp.module.scss';

type Product = 'analytics-api' | 'robot-api';
type Health = { status: string; profile: string; productRuntime: string };
type Connection = 'checking' | 'online' | 'offline' | 'wrong-profile';

const copy = {
  'analytics-api': {
    title: 'Речевая аналитика',
    description: 'Независимое рабочее пространство для анализа записей разговоров.',
    icon: Database,
    readiness: 'Обработка записей',
  },
  'robot-api': {
    title: 'AI-роботы',
    description: 'Независимое рабочее пространство для голосовых AI-агентов.',
    icon: Bot,
    readiness: 'Голосовой runtime',
  },
} as const;

export function StandaloneAiApp({ product }: { product: Product }) {
  const [connection, setConnection] = useState<Connection>('checking');
  const [runtime, setRuntime] = useState('not-installed');
  const configuration = copy[product];
  const Icon = configuration.icon;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setConnection('checking');
    try {
      const response = await fetch('/api/health', { signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('health unavailable');
      const result = await response.json() as Health;
      setRuntime(result.productRuntime);
      setConnection(result.profile === product && result.status === 'ok' ? 'online' : 'wrong-profile');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setConnection('offline');
    }
  }, [product]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const statusText = connection === 'checking' ? 'Проверка подключения…'
    : connection === 'online' ? 'API подключён'
      : connection === 'wrong-profile' ? 'Подключён API другого продукта' : 'API недоступен';
  const runtimeText = connection !== 'online' ? 'Нет данных'
    : runtime === 'not-installed' ? 'Не установлен' : 'Подключён';

  return (
    <VStack className={cls.shell} align="stretch">
      <HStack className={cls.topbar} justify="between">
        <HStack gap="4">
          <Text className={cls.brand}>K</Text>
          <Text className={cls.brandName}>Krasterisk</Text>
          <Text className={cls.separator}>/</Text>
          <Text className={cls.productName}>{configuration.title}</Text>
        </HStack>
        <Text className={cls.edition}>Отдельная установка</Text>
      </HStack>
      <HStack className={cls.body} align="stretch">
        <VStack className={cls.sidebar} align="stretch" justify="between">
          <VStack gap="4" align="stretch">
            <Text className={cls.navTitle}>Продукт</Text>
            <HStack className={cls.activeNav} gap="4"><Icon size={18} /><Text>Обзор</Text></HStack>
          </VStack>
          <Text className={cls.sidebarFoot}>Панель продукта</Text>
        </VStack>
        <VStack className={cls.content} align="stretch" gap="24">
          <VStack gap="8" align="stretch">
            <Text className={cls.eyebrow}>Рабочее пространство</Text>
            <Text variant="h1">{configuration.title}</Text>
            <Text className={cls.description}>{configuration.description}</Text>
          </VStack>
          <VStack className={cls.panel} align="stretch" gap="20">
            <HStack gap="4"><Activity size={20} /><Text variant="h2">Состояние установки</Text></HStack>
            <HStack className={cls.statusRow} justify="between" gap="8">
              <Text>API</Text><Text role="status" className={connection === 'online' ? cls.good : cls.needsAttention}>{statusText}</Text>
            </HStack>
            <HStack className={cls.statusRow} justify="between" gap="8">
              <Text>{configuration.readiness}</Text><Text className={runtimeText === 'Подключён' ? cls.good : cls.needsAttention}>{runtimeText}</Text>
            </HStack>
            <Button variant="outline" className={cls.refresh} onClick={() => void refresh()} disabled={connection === 'checking'}>
              <RefreshCw size={16} /> Проверить снова
            </Button>
          </VStack>
          <HStack className={cls.notice} gap="4">
            <ArrowRight size={18} />
            <Text>Настройки появятся после установки компонентов продукта и выдачи доступа администратором.</Text>
          </HStack>
        </VStack>
      </HStack>
    </VStack>
  );
}
