import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { VStack, HStack, Flex, Button } from '@/shared/ui';

export function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  return <VStack className="min-h-screen bg-background p-6" gap="24">
    <HStack max justify="between">
      <HStack gap="8"><Phone size={24} /><strong>Krasterisk</strong></HStack>
      <Button variant="ghost" onClick={() => void i18n.changeLanguage(i18n.language.startsWith('ru') ? 'en' : 'ru')}>{i18n.language.toUpperCase()}</Button>
    </HStack>
    <Flex className="w-full flex-1" justify="center" align="center">
      <VStack className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8" gap="24">
        <HStack gap="16">
          <Link to="/login">{t('auth.signIn', 'Войти')}</Link>
          <Link to="/register">{t('auth.createCompany', 'Создать организацию')}</Link>
        </HStack>
        <VStack gap="8"><h1 className="text-2xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></VStack>
        {children}
      </VStack>
    </Flex>
  </VStack>;
}
