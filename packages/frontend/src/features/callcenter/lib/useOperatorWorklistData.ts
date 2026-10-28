import { useMemo } from 'react';
import {
  useGetMissedCallsQuery,
  useGetMissedCallsGroupedQuery,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetCallbackRequestsQuery } from '@/shared/api/endpoints/callbackRequestsApi';
import { operatorWorkItems } from './operatorWorklist';

/** The table, tab counter and attention notice use exactly the same resolution rules. */
export function useOperatorWorklistData(enabled = true) {
  const raw = useGetMissedCallsQuery(
    { includeHandled: true },
    { skip: !enabled },
  );
  const active = useGetMissedCallsGroupedQuery(undefined, { skip: !enabled });
  const options = {
    skip: !enabled,
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
  };
  const callbacks = useGetCallbackRequestsQuery('active', options);
  const completed = useGetCallbackRequestsQuery('completed', options);
  const items = useMemo(
    () =>
      operatorWorkItems(
        raw.data || [],
        active.data || [],
        callbacks.data || [],
        completed.data || [],
      ),
    [raw.data, active.data, callbacks.data, completed.data],
  );
  const open = items.filter((item) => !item.resolved);
  return {
    items,
    openCount: open.length,
    missedCount: open.filter((item) => item.source === 'missed').length,
    isLoading:
      raw.isLoading ||
      active.isLoading ||
      callbacks.isLoading ||
      completed.isLoading,
    isError:
      raw.isError || active.isError || callbacks.isError || completed.isError,
  };
}
