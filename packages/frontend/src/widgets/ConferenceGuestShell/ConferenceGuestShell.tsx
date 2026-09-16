import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Avatar, Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './ConferenceGuestShell.module.scss';

export interface ConferenceGuestShellProps {
  roomName?: string;
  logoSrc?: string | null;
  children?: ReactNode;
}

export function ConferenceGuestShell({
  roomName = '',
  logoSrc,
  children,
}: ConferenceGuestShellProps) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ru' ? 'en' : 'ru';
    void i18n.changeLanguage(nextLang);
  };

  const langLabel = i18n.language.toUpperCase();

  return (
    <VStack className={cls.root} data-testid="conference-guest-shell" max>
      <HStack
        className={cls.header}
        justify="between"
        align="center"
        data-testid="conference-guest-header"
        max
      >
        <HStack gap="12" align="center" className={cls.brand}>
          <Flex
            className={cls.logo}
            data-testid="guest-tenant-logo"
            aria-hidden={logoSrc ? undefined : true}
          >
            {logoSrc ? <Avatar name={roomName || 'tenant'} src={logoSrc} size={32} /> : null}
          </Flex>
          {roomName ? (
            <Text className={cls.roomName} title={roomName}>
              {roomName}
            </Text>
          ) : null}
        </HStack>
        <Button
          id="guest-lang-toggle"
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          title={langLabel}
          aria-label={langLabel}
        >
          <Languages size={20} />
        </Button>
      </HStack>
      <Flex className={cls.body} justify="center" align="center" max>
        {children}
      </Flex>
    </VStack>
  );
}
