import { useSelector } from 'react-redux';
import { useGetOperatorCallHistoryQuery } from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcAgents,
} from '../model/selectors/callCenterSelectors';
import { useOperatorWorklistData } from './useOperatorWorklistData';
import type { KpiDisplayMode } from './agentPanelPrefs';

export function useOperatorPageCounts(
  enabled: boolean,
  period: KpiDisplayMode,
  currentCalls: number,
) {
  const me = useSelector(selectMyAgent),
    agents = useSelector(selectCcAgents);
  const work = useOperatorWorklistData(enabled);
  const history = useGetOperatorCallHistoryQuery(
    { period: period === 'day' ? 'day' : 'shift' },
    { skip: !enabled },
  );
  const colleagues = agents.filter(
    (agent) =>
      me &&
      agent.status !== 'OFFLINE' &&
      (agent.interface === me.interface ||
        agent.queues.some((queue) => me.queues.includes(queue))),
  );
  return {
    missed: work.missedCount,
    counts: {
      waiting: currentCalls,
      tasks: work.openCount,
      coworkers: colleagues.length,
      queues: me?.queues.length || 0,
      history: history.data?.length || 0,
    },
  };
}
