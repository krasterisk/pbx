import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Text } from '@/shared/ui';
import type { CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';
import styles from './AgentPanel.module.scss';

export interface AgentPanelProps {
  id: CcPanelKey;
  title: string;
  icon: LucideIcon;
  fullWidth?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

/** Fixed workspace card (U2.8): title + body, no drag handle and no collapse. */
export function AgentPanel({ id, title, icon: Icon, fullWidth = false, children, actions }: AgentPanelProps) {
  return (
    <section
      className={`${styles.panel} ${fullWidth ? styles.panelFull : styles.panelCompact}`}
      data-panel={id}
      data-testid={`cc-panel-${id}`}
      aria-label={title}
    >
      <div className={styles.panelHeader}>
        <Icon className="w-4 h-4" aria-hidden="true" />
        <Text as="h2" className={styles.panelTitle}>{title}</Text>
        {actions}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}
