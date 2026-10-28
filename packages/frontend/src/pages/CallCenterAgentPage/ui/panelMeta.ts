import { Users, Layers, PhoneIncoming, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CcPanelKey } from '@/features/callcenter/lib/agentPanelPrefs';

export const PANEL_META: Record<CcPanelKey, { icon: LucideIcon; labelKey: string; fallback: string }> = {
  coworkers: { icon: Users, labelKey: 'callcenter.tabs.coworkers', fallback: 'Coworkers' },
  queues: { icon: Layers, labelKey: 'callcenter.tabs.queues', fallback: 'Queues' },
  waiting: { icon: PhoneIncoming, labelKey: 'callcenter.tabs.waiting', fallback: 'Current calls' },
  history: { icon: History, labelKey: 'callcenter.tabs.history', fallback: 'History' },
};

export type PanelVisibility = Record<CcPanelKey, boolean>;
export type PanelBodies = Record<CcPanelKey, React.ReactNode>;
