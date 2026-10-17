import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';
import { saveAgentPanelPrefs, type AgentPanelView } from '../../lib/agentPanelPrefs';

/** Per-browser presentation only; does not change permissions or panel visibility. */
export function AgentPanelViewToggle({ panel, value }: { panel: 'coworkers' | 'queues'; value: AgentPanelView }) {
  const { t } = useTranslation();
  return <div className="flex gap-1" role="group" aria-label={t('callcenter.panelView', 'Section view')}>
    {(['table', 'cards'] as const).map((view) => {
      const Icon = view === 'table' ? List : LayoutGrid;
      const label = t(view === 'table' ? 'callcenter.viewTable' : 'callcenter.viewCards', view === 'table' ? 'Table' : 'Cards');
      return <Button key={view} size="none" variant={view === value ? 'secondary' : 'ghost'} className="w-8 h-8 inline-flex items-center justify-center"
        aria-label={label} title={label} aria-pressed={view === value}
        onClick={() => saveAgentPanelPrefs(panel === 'coworkers' ? { coworkersView: view } : { queuesView: view })}>
        <Icon className="w-4 h-4" aria-hidden="true" />
      </Button>;
    })}
  </div>;
}
