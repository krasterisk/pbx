import type { ReactNode } from 'react';
import { Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import styles from './AppFormSection.module.scss';

export interface AppFormSectionProps {
  title: string;
  tooltip?: string;
  children: ReactNode;
}

/** Always-visible primary block (ARCHITECTURE bordered group). */
export function AppFormSection({ title, tooltip, children }: AppFormSectionProps) {
  return (
    <VStack gap="12" max className={styles.section}>
      <HStack gap="4" align="center">
        <Text variant="small" className={styles.title}>
          {title}
        </Text>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </HStack>
      {children}
    </VStack>
  );
}
