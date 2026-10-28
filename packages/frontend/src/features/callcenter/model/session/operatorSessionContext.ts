import { createContext, useContext } from 'react';
import type { useOperatorSession } from './useOperatorSession';

type OperatorSession = ReturnType<typeof useOperatorSession>;

// Keep context identity independent of the provider's React Refresh boundary.
export const SessionContext = createContext<OperatorSession | null>(null);

export function useCallCenterSession() {
  const value = useContext(SessionContext);
  if (!value)
    throw new Error('CallCenterSessionProvider is required above the route outlet');
  return value;
}
