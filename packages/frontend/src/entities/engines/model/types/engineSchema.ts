export interface ITtsEngine {
  /** Legacy engine responses may omit availability metadata. */
  enabled?: boolean;
  uid: number;
  name: string;
  type: 'google' | 'yandex' | 'custom';
  token: string;
  settings: Record<string, any>;
  custom_url: string;
  auth_mode: 'none' | 'bearer' | 'custom';
  custom_headers: Record<string, string>;
  user_uid: number;
}

export interface ISttEngine {
  enabled?: boolean;
  uid: number;
  name: string;
  type: 'google' | 'yandex' | 'custom';
  token: string;
  settings: Record<string, any>;
  custom_url: string;
  auth_mode: 'none' | 'bearer' | 'custom';
  custom_headers: Record<string, string>;
  user_uid: number;
}
