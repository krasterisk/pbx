import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Star } from 'lucide-react';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import { classNames } from '@/shared/lib/classNames/classNames';
import type { HubModuleRow as HubModuleRowType } from '@/features/modules/types';
import { getModuleEntryPath } from '@/features/modules/lib/moduleRegistry';
import { UserLevel } from '@krasterisk/shared';
import cls from './ModuleHub.module.scss';

interface ModuleHubRowProps {
  row: HubModuleRowType;
  level: UserLevel | undefined;
  index: number;
  reduceMotion: boolean;
  onToggleFavorite: (code: string) => void;
}

export const ModuleHubRow = memo(function ModuleHubRow({
  row,
  level,
  index,
  reduceMotion,
  onToggleFavorite,
}: ModuleHubRowProps) {
  const { t } = useTranslation();
  const Icon = row.pages[0]?.icon;
  const name = row.catalogName || t(row.labelKey);
  const entryPath = getModuleEntryPath(row, level);
  const isDisabled = row.licenseStatus === 'disabled';
  const secondary =
    row.kind === 'base'
      ? t('hub.kindBase', 'Included')
      : t('hub.kindMarket', 'Extension');

  const pill =
    row.licenseStatus === 'disabled' ? (
      <Badge className={cls.pillOff}>{t('license.disabled')}</Badge>
    ) : (
      <Badge className={cls.pillOn}>{t('license.active')}</Badge>
    );

  const content = (
    <HStack
      gap="12"
      align="center"
      max
      className={classNames(cls.row, { [cls.rowDisabled]: isDisabled }, [])}
    >
      <Flex className={cls.iconBadge} align="center" justify="center">
        {Icon ? <Icon size={18} aria-hidden /> : null}
      </Flex>

      <VStack gap="2" style={{ flex: 1, minWidth: 0 }}>
        <Text as="span" className={cls.moduleName}>
          {name}
        </Text>
        <Text variant="muted">{secondary}</Text>
      </VStack>

      {pill}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={row.favorite ? cls.starActive : undefined}
        aria-label={
          row.favorite ? t('hub.removeFavorite') : t('hub.addFavorite')
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(row.code);
        }}
      >
        <Star size={16} fill={row.favorite ? 'currentColor' : 'none'} />
      </Button>

      {!isDisabled && (
        <ChevronRight className={cls.chevron} aria-hidden />
      )}
    </HStack>
  );

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, delay: Math.min(index * 0.04, 0.3) },
      };

  if (isDisabled) {
    return (
      <motion.div {...motionProps}>
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div {...motionProps}>
      <NavLink
        to={entryPath}
        className={cls.rowLink}
        aria-label={t('hub.openModule', { name })}
      >
        {content}
      </NavLink>
    </motion.div>
  );
});
