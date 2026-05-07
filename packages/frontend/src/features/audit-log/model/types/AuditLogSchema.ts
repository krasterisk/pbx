export type ActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_delete'
  | 'bulk_create'
  | 'bulk_create_error'
  | 'login'
  | 'register';

export type ActionStatus = 'success' | 'error';

export type EntityType =
  | 'user'
  | 'endpoint'
  | 'trunk'
  | 'route'
  | 'context'
  | 'number'
  | 'role'
  | 'ivr'
  | 'queue'
  | 'prompt'
  | 'moh'
  | 'auth'
  | string; // allow unknown entity types

export interface ActionLog {
  id: number;
  user_id: number;
  action: ActionType;
  entity_type: EntityType;
  entity_id: number | null;
  details: string | null;
  status: ActionStatus;
  user_uid: number;
  created_at: string;
}

export interface ActionLogListResponse {
  total: number;
  page: number;
  limit: number;
  items: ActionLog[];
}

export interface ActionLogStats {
  total: number;
  today: number;
  errors: number;
}

export interface ActionLogFilters {
  page?: number;
  limit?: number;
  action?: ActionType | '';
  entity_type?: EntityType | '';
  status?: ActionStatus | '';
  dateFrom?: string;
  dateTo?: string;
}
