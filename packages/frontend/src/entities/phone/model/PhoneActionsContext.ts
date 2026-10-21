import { createContext } from 'react';

/** The application phone owner supplies the current session. No credentials here. */
export interface PhoneActions {
  canCall: boolean;
  call: (number: string) => void | Promise<void>;
  configure?: () => void;
}

export const PhoneActionsContext = createContext<PhoneActions | null>(null);
export const PhoneActionsProvider = PhoneActionsContext.Provider;
