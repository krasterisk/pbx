import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import styles from './AppCollapsibleSection.module.scss';

export interface AppCollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  tooltip?: string;
  children: ReactNode;
}

/**
 * Secondary field group — bordered, collapsed by default (ARCHITECTURE.md §4).
 * Title + optional InfoTooltip on the left; chevron toggle on the far right
 * (no "Раскрыть" / "Свернуть" text).
 */
export function AppCollapsibleSection({
  title,
  open,
  onToggle,
  tooltip,
  children,
}: AppCollapsibleSectionProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const toggleLabel = open
    ? t('routes.chain.section.collapse', 'Свернуть')
    : t('routes.chain.section.expand', 'Раскрыть');

  return (
    <VStack gap={open ? '12' : '0'} max className={styles.collapsible}>
      <HStack gap="8" align="center" max justify="between" className={styles.titleRow}>
        <HStack gap="4" align="center" className={styles.titleCluster}>
          <Text className={styles.title}>{title}</Text>
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </HStack>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={onToggle}
        >
          <ChevronDown
            className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`}
            size={16}
            aria-hidden
          />
        </Button>
      </HStack>
      {open ? (
        <VStack gap="12" max id={panelId}>
          {children}
        </VStack>
      ) : null}
    </VStack>
  );
}
