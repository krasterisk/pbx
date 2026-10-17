import { useEffect } from 'react';

export interface AssistantPageContext {
  module: 'autodial'; page: 'campaigns' | 'campaign' | 'bases' | 'reports' | 'monitor';
  campaign_uid?: number; base_uid?: number; tab?: 'overview' | 'contacts' | 'scenario' | 'settings' | 'report' | 'journal'; dirty?: boolean;
}
let current: AssistantPageContext | undefined;
export const getAssistantPageContext = () => current;
export function useAssistantContext(context: AssistantPageContext) {
  const key = JSON.stringify(context);
  useEffect(() => {
    const value = JSON.parse(key) as AssistantPageContext;
    current = value;
    return () => { if (current === value) current = undefined; };
  }, [key]);
}
