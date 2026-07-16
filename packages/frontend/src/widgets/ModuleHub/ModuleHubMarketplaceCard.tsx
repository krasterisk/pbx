import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { toast } from 'react-toastify';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack, Flex } from '@/shared/ui/Stack';
import type { HubModuleRow } from '@/features/modules/types';
import cls from './ModuleHub.module.scss';

interface ModuleHubMarketplaceCardProps {
  row: HubModuleRow;
  index: number;
  reduceMotion: boolean;
}

export const ModuleHubMarketplaceCard = memo(function ModuleHubMarketplaceCard({
  row,
  index,
  reduceMotion,
}: ModuleHubMarketplaceCardProps) {
  const { t } = useTranslation();
  const Icon = row.pages[0]?.icon;
  const name = row.catalogName || t(row.labelKey);

  const handleBuy = () => {
    // CheckoutSheet lands in plan 08-06 — placeholder CTA only
    toast.info(t('hub.buyPlaceholder', 'Checkout will be available soon'));
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, delay: Math.min(index * 0.04, 0.3) },
      };

  return (
    <motion.div {...motionProps}>
      <HStack gap="12" align="center" max className={cls.marketCard}>
        <Flex className={cls.iconBadge} align="center" justify="center">
          {Icon ? <Icon size={18} aria-hidden /> : null}
        </Flex>

        <VStack gap="2" style={{ flex: 1, minWidth: 0 }}>
          <Text as="span" className={cls.moduleName}>
            {name}
          </Text>
          <Text variant="muted">{t('hub.kindMarket', 'Extension')}</Text>
        </VStack>

        <Badge className={cls.pillLock}>{t('license.locked')}</Badge>

        <Button type="button" size="sm" onClick={handleBuy} id={`hub-buy-${row.code}`}>
          {t('marketplace.buy')}
        </Button>
      </HStack>
    </motion.div>
  );
});
