import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Star } from 'lucide-react';
import { Badge, Button, Text, NavItem } from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import type { HubModuleRow as HubModuleRowType } from '@/features/modules/types';
import { useModuleDestination } from '@/features/modules/hooks/useNavigationHistory';
import type { UserLevel } from '@krasterisk/shared';
import cls from './ModuleHub.module.scss';

interface ModuleHubRowProps {
  row: HubModuleRowType;
  level: UserLevel | undefined;
  index: number;
  reduceMotion: boolean;
  onToggleFavorite: (code: string) => void;
}

export const ModuleHubRow = memo(function ModuleHubRow({ row, level, onToggleFavorite }: ModuleHubRowProps) {
  const { t } = useTranslation();
  const getDestination = useModuleDestination(level);
  const Icon = row.pages[0]?.icon;
  const name = t(row.labelKey);
  const disabled = row.licenseStatus === 'disabled';
  const content = <HStack gap='12' className={cls.rowContent} max>
    <Flex className={cls.iconBadge} justify='center'>{Icon && <Icon size={18} aria-hidden />}</Flex>
    <VStack gap='2' className={cls.rowDescription}>
      <Text as='span' className={cls.moduleName}>{name}</Text>
      <Text variant='muted'>{t(row.kind === 'base' ? 'hub.kindBase' : 'hub.kindMarket')}</Text>
    </VStack>
    <Badge className={disabled ? cls.pillOff : cls.pillOn}>{t(disabled ? 'license.disabled' : 'license.active')}</Badge>
    {!disabled && <ChevronRight size={16} className={cls.chevron} aria-hidden />}
  </HStack>;
  return <HStack className={cls.row} gap='8'>
    {disabled ? <Flex className={cls.rowLink}>{content}</Flex> :
      <NavItem to={getDestination(row)} className={cls.rowLink} aria-label={t('hub.openModule', { name })}>{content}</NavItem>}
    <Button type='button' variant='ghost' size='icon' className={row.favorite ? cls.starActive : undefined}
      aria-label={row.favorite ? t('hub.removeFavorite') : t('hub.addFavorite')} aria-pressed={row.favorite}
      onClick={() => onToggleFavorite(row.code)}>
      <Star size={16} fill={row.favorite ? 'currentColor' : 'none'} aria-hidden />
    </Button>
  </HStack>;
});
