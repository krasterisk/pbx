import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui';
import { AgentPanel } from '@/features/callcenter/ui/AgentPanel';
import { AgentPanelViewToggle } from '@/features/callcenter/ui/AgentPanel/AgentPanelViewToggle';
import type { AgentPanelPrefs } from '@/features/callcenter/lib/agentPanelPrefs';
import { DEFAULT_PANEL_ORDER, type CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';
import { PANEL_META, type PanelBodies, type PanelVisibility } from './panelMeta';
import styles from '../CallCenterAgentPage.module.scss';

export interface AgentIdleLayoutProps {
  isMobile: boolean;
  visibility: PanelVisibility;
  bodies: PanelBodies;
  prefs?: AgentPanelPrefs;
}

/**
 * Operator workspace between calls (U2.2): fixed panels in a grid on desktop (Waiting / History
 * full width), the shared Tabs on phone (Waiting first - what needs attention).
 */
export function AgentIdleLayout({ isMobile, visibility, bodies, prefs }: AgentIdleLayoutProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CcPanelKey>('waiting');
  const order = DEFAULT_PANEL_ORDER.filter((key) => visibility[key]);
  const current = order.includes(activeTab) ? activeTab : (order[0] ?? 'waiting');

  if (isMobile || prefs?.desktopTabs) {
    return (
      <div className={styles.tabsArea}>
        <Tabs value={current} onValueChange={(v) => setActiveTab(v as CcPanelKey)}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList aria-label={t('callcenter.agent.sections', 'Sections')}>
            {order.map((key) => {
              const meta = PANEL_META[key];
              const Icon = meta.icon;
              return (
                <TabsTrigger key={key} value={key}>
                  <Icon className="w-3.5 h-3.5 mr-1 inline" aria-hidden="true" />
                  {t(meta.labelKey, meta.fallback)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {!isMobile && (current === 'coworkers' || current === 'queues') && <AgentPanelViewToggle panel={current} value={current === 'coworkers' ? prefs?.coworkersView ?? 'cards' : prefs?.queuesView ?? 'cards'} />}
          </div>
          {order.map((key) => (
            <TabsContent key={key} value={key}>
              {bodies[key]}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  return (
    <div className={styles.tabsArea}>
      <div className={styles.panelColumns}>
        {order.map((key) => {
          const meta = PANEL_META[key];
          return (
            <AgentPanel
              key={key}
              id={key}
              title={t(meta.labelKey, meta.fallback)}
              icon={meta.icon}
              fullWidth={key === 'waiting' || key === 'history'}
              actions={(key === 'coworkers' || key === 'queues') ? <AgentPanelViewToggle panel={key} value={key === 'coworkers' ? prefs?.coworkersView ?? 'cards' : prefs?.queuesView ?? 'cards'} /> : undefined}
            >
              {bodies[key]}
            </AgentPanel>
          );
        })}
      </div>
    </div>
  );
}
