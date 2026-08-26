import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Text } from '@/shared/ui';
import type { CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';
import styles from './SortableAgentPanel.module.scss';

export interface SortableAgentPanelProps {
  id: CcPanelKey;
  title: string;
  icon: LucideIcon;
  fullWidth?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  summary?: ReactNode;
  children: ReactNode;
}

/**
 * Sortable ARM card - drag handle in header; optional collapse for Waiting/History.
 */
export function SortableAgentPanel({
  id,
  title,
  icon: Icon,
  fullWidth = false,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  summary,
  children,
}: SortableAgentPanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.panel} ${fullWidth ? styles.panelFull : styles.panelCompact}${collapsed ? ` ${styles.panelCollapsed}` : ''}${isDragging ? ` ${styles.panelDragging}` : ''}`}
      data-panel={id}
      data-testid={`cc-panel-${id}`}
    >
      <div className={styles.panelHeader}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Reorder ${title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Icon className="w-4 h-4" />
        <Text as="h2" className={styles.panelTitle}>{title}</Text>
        {collapsed && summary ? (
          <div className={styles.headerSummary} data-testid="cc-panel-header-summary">
            {summary}
          </div>
        ) : null}
        {collapsible && onToggleCollapse ? (
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className={styles.panelBody}>{children}</div>
      )}
    </div>
  );
}
