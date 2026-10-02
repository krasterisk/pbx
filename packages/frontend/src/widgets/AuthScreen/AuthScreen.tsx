import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Moon, Sun } from 'lucide-react';
import { VStack, HStack, Flex, Button, Text } from '@/shared/ui';
import cls from './AuthScreen.module.scss';

/** Shared sign-in chrome: brand header and footer. */
export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const nextLanguage = i18n.language.startsWith('ru') ? 'en' : 'ru';
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme') !== 'light';
    } catch {
      return true;
    }
  });

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
  };

  return (
    <VStack className={cls.screen} gap="0" max>
      <Flex className={cls.orbA} aria-hidden="true" />
      <Flex className={cls.orbB} aria-hidden="true" />
      <Flex as="header" className={cls.header} justify="between" align="center" max>
        <HStack gap="12" align="center" className={cls.brandLockup}>
          <img className={cls.logo} src="/brand/aipbx-logo.png?v=2" alt="" width={48} height={48} />
          <Text as="span" variant="h3" className={cls.brand}>AI PBX Krasterisk</Text>
        </HStack>
        <HStack gap="4" align="center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isDark ? t('auth.themeToLight') : t('auth.themeToDark')}
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('auth.language')}
            onClick={() => void i18n.changeLanguage(nextLanguage)}
          >
            <Languages size={16} />
            {nextLanguage.toUpperCase()}
          </Button>
        </HStack>
      </Flex>
      <Flex className={cls.stage} justify="center" align="center" max>
        <VStack className={cls.card} gap="24">
          <VStack gap="8">
            <Text as="h1" variant="h2">{title}</Text>
            <Text variant="muted">{description}</Text>
          </VStack>
          {children}
        </VStack>
      </Flex>
      <Flex as="footer" className={cls.footer} justify="center">
        <Text variant="xs" align="center">
          {t('auth.copyright', { year: new Date().getFullYear() })}
        </Text>
      </Flex>
    </VStack>
  );
}
