import { IRouteAction, IIvrPhrase } from '@krasterisk/shared';

export interface IIvrMenuItem {
  digit: string;
  actions: IRouteAction[];
}

export interface IIvr {
  uid: number;
  name: string;
  /** WaitExten — seconds to wait for menu choice after prompts */
  timeout: string | null;
  /** Asterisk TIMEOUT(response) — first digit timeout (sec) */
  timeout_response?: string | null;
  /** Asterisk TIMEOUT(digit) — inter-digit pause (sec) */
  timeout_digit?: string | null;
  max_count: number;
  active: number;
  direct_dial: number;
  prompts: IIvrPhrase[];
  menu_items: IIvrMenuItem[];
  user_uid: number;
  created_at?: string;
  updated_at?: string;
}

export interface IvrSchema {
  isLoading: boolean;
  error?: string;
}
