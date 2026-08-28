import type { IRouteAction } from './route.types';

export type DirectoryFieldType = 'string' | 'phone' | 'number' | 'boolean';
export type DirectoryMatchKind = 'exact' | 'asterisk_pattern';
export type DirectoryKeyNormalization = 'none' | 'digits';
export type DirectoryLookupStatus = 'FOUND' | 'NOT_FOUND' | 'ERROR';
export type DirectoryMatchMode = 'on_match' | 'on_no_match';
export type DirectoryBehaviorType =
  | 'set_name'
  | 'set_number'
  | 'drop'
  | 'redirect'
  | 'map_fields'
  | 'custom';

export type CallValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'original_caller' }
  | { source: 'current_caller' };

export interface DirectoryValueSource {
  source: 'directory';
  directoryUid: number;
  keySource: CallValueSource;
  valueFieldUid: number;
  onMissing: 'keep' | 'empty' | 'skip';
}

export interface DirectoryLookupOutput {
  fieldUid: number;
  targetVariable: string;
}

export interface IDirectoryLookupParams {
  directoryUid: number;
  keySource: CallValueSource;
  outputs: DirectoryLookupOutput[];
  onMissing: 'keep' | 'empty';
}

export type TrunkCallerIdSource =
  | { mode: 'static'; value?: string }
  | {
      mode: 'directory';
      directoryUid: number;
      valueFieldUid: number;
      keySource: { source: 'original_caller' };
      onMissing: 'keep_original';
    };

export interface ITrunkCarouselItem {
  trunkId: string;
  callerId: TrunkCallerIdSource;
  timeout?: number;
}

export interface IDirectoryField {
  uid: number;
  directory_uid: number;
  key: string;
  label: string;
  type: DirectoryFieldType;
  required: boolean;
  position: number;
}

export interface IDirectoryRecord {
  uid: number;
  directory_uid: number;
  lookup_value: string;
  normalized_lookup_value: string;
  match_kind: DirectoryMatchKind;
  priority: number;
  /** JSON object keyed by decimal `field_uid`. */
  values: Record<string, unknown>;
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IDirectory {
  uid: number;
  user_uid: number;
  name: string;
  description?: string;
  lookup_field_uid: number;
  key_normalization: DirectoryKeyNormalization;
  revision: number;
  created_at?: string;
  updated_at?: string;
  fields?: IDirectoryField[];
  records?: IDirectoryRecord[];
}

export interface DirectoryFieldMapping {
  fieldUid: number;
  targetVariable: string;
}

export interface IDirectoryBehaviorParams {
  fieldUid?: number;
  fixed?: string;
  fixedExten?: string;
  targetContext?: string;
  mappings?: DirectoryFieldMapping[];
}

export interface IRouteDirectoryBinding {
  uid?: number;
  route_uid?: number;
  directory_uid: number;
  position: number;
  key_source: CallValueSource;
  match_mode: DirectoryMatchMode;
  behavior_type: DirectoryBehaviorType;
  behavior_params?: IDirectoryBehaviorParams | null;
  actions?: IRouteAction[] | null;
  user_uid?: number;
  directory?: IDirectory;
}
