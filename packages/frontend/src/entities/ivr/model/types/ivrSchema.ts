import { IRouteAction } from '@/shared/api/api';

export interface IIvrMenuItem {
  digit: string;
  actions: IRouteAction[];
}

export interface IIvr {
  uid: number;
  name: string;
  exten: string;
  timeout: string | null;
  max_count: number;
  active: number;
  direct_dial: number;
  prompts: string[];
  menu_items: IIvrMenuItem[];
  user_uid: number;
  created_at?: string;
  updated_at?: string;
}

export interface IvrSchema {
  isLoading: boolean;
  error?: string;
}
