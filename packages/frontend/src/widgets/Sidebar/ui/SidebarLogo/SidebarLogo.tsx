import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone } from 'lucide-react';
import { HStack, Flex } from '@/shared/ui/Stack';
import cls from '../../Sidebar.module.scss'; // using shared module for now

interface SidebarLogoProps {
  isVisuallyExpanded: boolean;
}

export const SidebarLogo = memo(({ isVisuallyExpanded }: SidebarLogoProps) => {
  return (
    <HStack className={cls.header} align="center">
      <HStack gap="12" align="center" style={{ overflow: 'hidden' }}>
        <Flex className={cls.logoBox} align="center" justify="center">
          <Phone className={cls.logoIcon} />
        </Flex>
        
        <AnimatePresence>
          {isVisuallyExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className={cls.logoText}
            >
              Krasterisk
            </motion.span>
          )}
        </AnimatePresence>
      </HStack>
    </HStack>
  );
});
