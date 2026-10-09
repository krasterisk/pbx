export type PjsipValue = string | number | boolean | null | undefined;
export type PjsipSettings = Record<string, PjsipValue>;

export interface IEndpointWebrtcStatus {
  id: string;
  status: "online" | "offline";
  userAgent?: string | null;
}

export interface IEndpointListItem {
  id: string;
  extension: string;
  sipUsername: string;
  callerid: string;
  context: string;
  transport: string;
  allow: string;
  status: "online" | "offline";
  userAgent: string | null;
  clientIp: string | null;
  contactUri: string | null;
  lastRegistered: number | null;
  tenantid: string;
  authType: string;
  department?: string | null;
  direct_media?: string | null;
  force_rport?: string | null;
  allow_subscribe?: string | null;
  named_call_group?: string | null;
  named_pickup_group?: string | null;
  provision_enabled?: boolean | number;
  mac_address?: string | null;
  provision_template_id?: number | null;
  pv_vars?: string | null;
  permit?: string | null;
  deny?: string | null;
  webrtc_enabled?: boolean;
  blf_enabled?: boolean;
  blf_applied?: boolean;
  webrtc?: IEndpointWebrtcStatus | null;
  /** Extra engine columns are checked before use by consumers. */
  [key: string]: unknown;
}

export interface IEndpointDetail {
  blf_applied?: boolean;
  endpoint: PjsipSettings;
  auth: PjsipSettings | null;
  aor: PjsipSettings | null;
  extension: string;
  sipUsername: string;
  status: "online" | "offline";
  userAgent: string | null;
  clientIp: string | null;
  contactUri: string | null;
  lastRegistered: number | null;
}

export interface IEndpointCredentials {
  sipId: string;
  extension: string;
  username: string;
  password: string;
  authType: string;
  domain: string;
  webrtc?: Omit<IEndpointCredentials, "webrtc"> & { transport?: string };
}

export interface ICreateEndpoint {
  extension: string;
  password: string;
  context: string;
  displayName?: string;
  transport?: string;
  codecs?: string;
  natProfile?: "lan" | "nat";
  webrtcEnabled?: boolean;
  blfEnabled?: boolean;
  department?: string;
  namedCallGroup?: string;
  namedPickupGroup?: string;
  provisionEnabled?: boolean;
  macAddress?: string;
  provisionTemplateId?: number;
  pvVars?: string;
  advanced?: PjsipSettings;
}

export interface IUpdateEndpoint {
  endpoint: PjsipSettings;
  auth?: { password: string };
  aor?: PjsipSettings;
}

export interface IBulkCreateEndpoint {
  extensionsPattern: string;
  passwordPattern: string;
  context: string;
  displayNamePattern?: string;
  transport?: string;
  codecs?: string;
  natProfile?: "lan" | "nat";
  webrtcEnabled?: boolean;
  department?: string;
}

export interface IBulkCreateResult {
  created?: string[];
  skipped?: string[];
  total: number;
  jobId?: string;
  message?: string;
}

export interface IBulkJobStatus {
  id: string;
  total: number;
  processed: number;
  created: string[];
  skipped: string[];
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export interface IPickupGroup {
  uid: number;
  name: string;
  slug: string;
}
