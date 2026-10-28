import { Fragment, useState, type ReactNode } from 'react';
import { ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  VStack,
  HStack,
  Text,
} from '@/shared/ui';
import type { AgentPanelPrefs } from '@/features/callcenter/lib/agentPanelPrefs';
import {
  DEFAULT_PANEL_ORDER,
  type CcPanelKey,
} from '@/features/callcenter/lib/agentPanelPrefs';
import {
  PANEL_META,
  type PanelBodies,
  type PanelVisibility,
} from './panelMeta';
import styles from '../CallCenterAgentPage.module.scss';

export interface AgentIdleLayoutProps {
  isMobile: boolean;
  visibility: PanelVisibility;
  bodies: PanelBodies;
  prefs?: AgentPanelPrefs;
  currentCallsCount?: number;
  worklist?: ReactNode;
  counts?: Partial<Record<CcPanelKey | 'tasks', number>>;
  value?: CcPanelKey | 'tasks';
  onValueChange?: (value: CcPanelKey | 'tasks') => void;
}

/**
 * One active work section on every screen; section visibility and table/card preferences remain configurable.
 */
export function AgentIdleLayout({
  visibility,
  bodies,
  currentCallsCount = 0,
  worklist,
  counts,
  value,
  onValueChange,
}: AgentIdleLayoutProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CcPanelKey | 'tasks'>('waiting');
  const order = (
    [
      'waiting',
      ...DEFAULT_PANEL_ORDER.filter((key) => key !== 'waiting'),
    ] as CcPanelKey[]
  ).filter((key) => visibility[key]);
  const selected = value ?? activeTab;
  const current =
    selected === 'tasks' && worklist
      ? 'tasks'
      : order.includes(selected as CcPanelKey)
        ? selected
        : (order[0] ?? 'tasks');
  const count = (key: CcPanelKey | 'tasks') =>
    counts?.[key] ?? (key === 'waiting' ? currentCallsCount : 0);
  const taskTab = (
    <TabsTrigger value="tasks">
      <ListTodo size={15} className={styles.sectionIcon} aria-hidden />
      {t('callcenter.tabs.tasks', 'To do')}
      <Text
        as="span"
        className={styles.tabCount}
        data-attention={count('tasks') > 0}
      >
        {count('tasks')}
      </Text>
    </TabsTrigger>
  );

  if (order.length === 0 && !worklist) return null;
  return (
    <VStack align="stretch" max className={styles.tabsArea}>
      <Tabs
        value={current}
        onValueChange={(v) => {
          setActiveTab(v as CcPanelKey | 'tasks');
          onValueChange?.(v as CcPanelKey | 'tasks');
        }}
      >
        <HStack
          justify="between"
          gap="12"
          max
          className={styles.sectionToolbar}
        >
          <TabsList
            className={styles.workTabs}
            aria-label={t('callcenter.agent.sections', 'Sections')}
          >
            {order.map((key) => {
              const meta = PANEL_META[key];
              const Icon = meta.icon;
              return (
                <Fragment key={key}>
                  <TabsTrigger value={key}>
                    <Icon
                      size={15}
                      className={styles.sectionIcon}
                      aria-hidden="true"
                    />
                    {t(meta.labelKey, meta.fallback)}
                    <Text as="span" className={styles.tabCount}>
                      {count(key)}
                    </Text>
                  </TabsTrigger>
                  {key === 'waiting' && worklist && taskTab}
                </Fragment>
              );
            })}
            {!order.includes('waiting') && worklist && taskTab}
          </TabsList>
        </HStack>
        {order.map((key) => (
          <TabsContent key={key} value={key} className={styles.sectionBody}>
            {bodies[key]}
          </TabsContent>
        ))}
        {worklist && (
          <TabsContent
            value="tasks"
            forceMount
            hidden={current !== 'tasks'}
            className={styles.sectionBody}
          >
            {worklist}
          </TabsContent>
        )}
      </Tabs>
    </VStack>
  );
}
