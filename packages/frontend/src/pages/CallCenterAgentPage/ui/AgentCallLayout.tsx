import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  VStack,
  HStack,
  Text,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui';
import { DEFAULT_PANEL_ORDER, type CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';
import { PANEL_META, type PanelBodies, type PanelVisibility } from './panelMeta';
import styles from '../CallCenterAgentPage.module.scss';

export interface AgentCallLayoutProps {
  isMobile: boolean;
  /** Client card, inline call card, wrap-up. */
  children: ReactNode;
  visibility: PanelVisibility;
  bodies: PanelBodies;
  /** Number of calls waiting in the queues - badge on the Waiting rail button. */
  waitingCount: number;
}

/**
 * Operator workspace during a call and wrap-up (U2.2): the call context takes the main area;
 * Coworkers / Queues / Waiting / History fold into a rail of icons with badges that open a side
 * sheet (bottom sheet on phone) instead of competing with the call for the screen.
 */
export function AgentCallLayout({ isMobile, children, visibility, bodies, waitingCount }: AgentCallLayoutProps) {
  const { t } = useTranslation();
  const [openPanel, setOpenPanel] = useState<CcPanelKey | null>(null);
  const panelTitleRef = useRef<HTMLHeadingElement>(null);
  const keys = DEFAULT_PANEL_ORDER.filter((key) => visibility[key]);
  const openMeta = openPanel ? PANEL_META[openPanel] : null;

  return (
    <VStack align="stretch" max className={`${styles.callLayout}${isMobile ? ` ${styles.callLayoutPhone}` : ''}`} data-testid="cc-agent-call-layout">
      <VStack align="stretch" max className={styles.callMain}>{children}</VStack>

      <HStack as="nav"
        className={styles.rail}
        aria-label={t('callcenter.agent.sections', 'Sections')}
        data-testid="cc-agent-rail"
      >
        {keys.map((key) => {
          const meta = PANEL_META[key];
          const Icon = meta.icon;
          const label = t(meta.labelKey, meta.fallback);
          const badge = key === 'waiting' && waitingCount > 0 ? waitingCount : 0;
          return (
            <Button
              key={key}
              type="button"
              variant="unstyled"
              size="sm"
              className={styles.railButton}
              onClick={() => setOpenPanel(key)}
              aria-label={badge ? `${label}: ${badge}` : label}
              data-testid={`cc-rail-${key}`}
            >
              <Icon size={16} aria-hidden="true" />
              <Text as="span" className={styles.railLabel}>{label}</Text>
              {badge ? <Text as="span" className={styles.railBadge} aria-hidden="true">{badge}</Text> : null}
            </Button>
          );
        })}
      </HStack>

      <Sheet open={openPanel !== null} onOpenChange={(o) => !o && setOpenPanel(null)}>
        <SheetContent side="right" className={styles.panelSheet} onOpenAutoFocus={event => { event.preventDefault(); panelTitleRef.current?.focus(); }}>
          <SheetHeader>
            <SheetTitle ref={panelTitleRef} tabIndex={-1}>{openMeta ? t(openMeta.labelKey, openMeta.fallback) : ''}</SheetTitle>
            <SheetDescription className={styles.srOnly}>
              {t('callcenter.agent.railDescription', 'Workspace panel')}
            </SheetDescription>
          </SheetHeader>
          <VStack align="stretch" max className={styles.sheetBody}>{openPanel ? bodies[openPanel] : null}</VStack>
        </SheetContent>
      </Sheet>
    </VStack>
  );
}
