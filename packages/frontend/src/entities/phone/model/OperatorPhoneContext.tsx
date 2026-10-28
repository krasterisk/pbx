import { createContext, useContext } from 'react';

export interface OperatorDialRequest {
  target: string;
  queue?: string;
  /** SIP callback API already originated the call; opening the widget must not originate again. */
  serverStarted?: boolean;
}

export interface OperatorPhoneActions {
  active: boolean;
  canDial: boolean;
  open: () => void;
  dial: (target: string) => Promise<void>;
  startOutbound: (request: OperatorDialRequest) => void;
}

const OperatorPhoneContext = createContext<OperatorPhoneActions | null>(null);
export const OperatorPhoneProvider = OperatorPhoneContext.Provider;
export const useOperatorPhone = () => useContext(OperatorPhoneContext);
