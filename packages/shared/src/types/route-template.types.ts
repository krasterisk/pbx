import type { IRouteAction } from './route.types';

export const TEMPLATE_SLOT_KINDS = [
  'queue',
  'group',
  'ivr',
  'trunk',
  'recording',
  'directory',
] as const;

export type TemplateSlotKind = (typeof TEMPLATE_SLOT_KINDS)[number];

export interface ITemplateSlot {
  id: string;
  kind: TemplateSlotKind;
  label: string;
}

/** Tenant-owned row when `vpbx_user_uid` is set; built-in catalog when null (D-33). */
export interface IRouteTemplate {
  uid: number;
  name: string;
  description: string;
  actions: IRouteAction[];
  slots: ITemplateSlot[];
  vpbx_user_uid: number | null;
  created_at: string;
  updated_at: string;
}

export interface ITemplateSlotValue {
  uid: string | number;
  name?: string;
}

export type ApplyTemplateMode = 'replace' | 'append';

export const TEMPLATE_SLOT_MARKER_RE = /^__slot:(.+)__$/;

export function templateSlotMarker(slotId: string): string {
  return `__slot:${slotId}__`;
}

export function parseTemplateSlotMarker(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(TEMPLATE_SLOT_MARKER_RE);
  return match?.[1] ?? null;
}
