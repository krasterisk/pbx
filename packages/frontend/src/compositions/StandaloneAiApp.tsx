import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, Bot, Database, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Text } from '@/shared/ui/Text';
import cls from './StandaloneAiApp.module.scss';

type Product = 'analytics-api' | 'robot-api';
type Health = { status: string; profile: string; productRuntime: string };
type Connection = 'checking' | 'online' | 'offline' | 'wrong-profile';
type Capabilities = {
  tenantUid: number;
  principalKind: string;
  productRuntime: string;
  usable: boolean;
  entitlement: { product: string; allowed: boolean; reason: string | null };
};

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

const onboarding = {
  'analytics-api': [
    'Проект',
    'Ключ интеграции',
    'Загрузка образца',
    'Результат анализа',
  ],
  'robot-api': [
    'Провайдер',
    'Промпт',
    'Тестовый звонок',
    'SIP-профиль',
    'Публикация',
  ],
} as const;

function entitlementText(capabilities: Capabilities | null): string {
  if (!capabilities) return 'Нет данных';
  if (capabilities.productRuntime === 'expired'
    || capabilities.entitlement.reason === 'license_expired'
    || capabilities.entitlement.reason === 'entitlement_expired') {
    return 'Срок лицензии истёк';
  }
  if (capabilities.entitlement.allowed && capabilities.usable) return 'Доступен';
  if (capabilities.productRuntime === 'entitled-not-installed') {
    return 'Лицензия есть, установка не завершена';
  }
  if (capabilities.productRuntime === 'installed' && !capabilities.usable) {
    return 'Установлен, продукт выключен';
  }
  if (capabilities.entitlement.reason === 'license_invalid') return 'Нет лицензии';
  if (capabilities.entitlement.reason === 'package_missing') return 'Пакет не установлен';
  if (capabilities.productRuntime === 'not-installed') return 'Runtime не установлен';
  return capabilities.entitlement.reason ?? 'Недоступен';
}

function runtimeLabel(runtime: string): string {
  if (runtime === 'installed') return 'Установлен';
  if (runtime === 'entitled-not-installed') return 'Лицензия есть, runtime не установлен';
  if (runtime === 'expired') return 'Срок лицензии истёк';
  if (runtime === 'community-core') return 'Community';
  return 'Не установлен';
}

export function StandaloneAiApp({ product }: { product: Product }) {
  const [connection, setConnection] = useState<Connection>('checking');
  const [runtime, setRuntime] = useState('not-installed');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
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

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setAuthError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (!response.ok) {
        setAuthError('Неверный логин или пароль');
        return;
      }
      const result = await response.json() as { accessToken?: string };
      if (!result.accessToken) {
        setAuthError('Неверный логин или пароль');
        return;
      }
      const described = await fetch('/api/v1/identity/capabilities', {
        credentials: 'omit', cache: 'no-store',
        headers: { authorization: `Bearer ${result.accessToken}` },
      });
      if (!described.ok) {
        setAuthError('Не удалось прочитать доступ продукта');
        return;
      }
      setAccessToken(result.accessToken);
      setPassword('');
      setCapabilities(await described.json() as Capabilities);
    } catch {
      setAuthError('API недоступен');
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    setAccessToken(null);
    setCapabilities(null);
    setPassword('');
  };

  const statusText = connection === 'checking' ? 'Проверка подключения…'
    : connection === 'online' ? 'API подключён'
      : connection === 'wrong-profile' ? 'Подключён API другого продукта' : 'API недоступен';
  const runtimeText = connection !== 'online' ? 'Нет данных' : runtimeLabel(runtime);

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
              <Text>{configuration.readiness}</Text><Text className={runtimeText === 'Установлен' ? cls.good : cls.needsAttention}>{runtimeText}</Text>
            </HStack>
            <HStack className={cls.statusRow} justify="between" gap="8">
              <Text>Доступ</Text>
              <Text className={capabilities?.entitlement.allowed ? cls.good : cls.needsAttention}>
                {accessToken ? entitlementText(capabilities) : 'Требуется вход'}
              </Text>
            </HStack>
            <Button variant="outline" className={cls.refresh} onClick={() => void refresh()} disabled={connection === 'checking'}>
              <RefreshCw size={16} /> Проверить снова
            </Button>
          </VStack>
          {accessToken && capabilities ? (
            <VStack className={cls.panel} align="stretch" gap="16">
              <HStack justify="between">
                <Text variant="h2">Сеанс администратора</Text>
                <Button variant="outline" onClick={signOut}><LogOut size={16} /> Выйти</Button>
              </HStack>
              <HStack className={cls.statusRow} justify="between" gap="8">
                <Text>Тенант</Text><Text>{String(capabilities.tenantUid)}</Text>
              </HStack>
              <Text className={cls.noticeInline}>
                Токен хранится только в этой вкладке и не записывается в localStorage.
              </Text>
              <VStack align="stretch" gap="8">
                <Text variant="h2">Первый запуск</Text>
                <ol className={cls.onboarding}>
                  {onboarding[product].map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </VStack>
            </VStack>
          ) : (
            <form className={cls.panel} onSubmit={(event) => void signIn(event)}>
              <VStack align="stretch" gap="16">
                <Text variant="h2">Вход администратора</Text>
                <label className={cls.field} htmlFor="standalone-login">
                  <Text as="span">Логин</Text>
                  <Input id="standalone-login" name="login" autoComplete="username" value={login}
                    onChange={(event) => setLogin(event.target.value)} required />
                </label>
                <label className={cls.field} htmlFor="standalone-password">
                  <Text as="span">Пароль</Text>
                  <Input id="standalone-password" name="password" type="password" autoComplete="current-password"
                    value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                {authError ? <Text role="alert" className={cls.needsAttention}>{authError}</Text> : null}
                <Button type="submit" disabled={signingIn || connection !== 'online'}>Войти</Button>
              </VStack>
            </form>
          )}
          <HStack className={cls.notice} gap="4">
            <ArrowRight size={18} />
            <Text>Настройки появятся после установки компонентов продукта и выдачи доступа администратором.</Text>
          </HStack>
        </VStack>
      </HStack>
    </VStack>
  );
}
