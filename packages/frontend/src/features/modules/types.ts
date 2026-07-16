import type { LucideIcon } from 'lucide-react';
import type { UserLevel } from '@krasterisk/shared';

/** Hub license pill states (UI-SPEC Active / Disabled / Locked). */
export type LicenseStatus = 'active' | 'locked' | 'disabled';

export interface ModulePageDef {
  id: string;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** If set, page is visible only when user level is in this list. */
  minLevels?: UserLevel[];
}

export interface ModuleDef {
  code: string;
  kind: 'base' | 'market';
  navVariant: 'tabs' | 'sidebar';
  pages: ModulePageDef[];
  /** i18n key for Hub tile / chip label */
  labelKey: string;
}

/** Hub list row: baseline ModuleDef + server licenseStatus + favorite flag. */
export interface HubModuleRow extends ModuleDef {
  licenseStatus: LicenseStatus;
  favorite: boolean;
  /** Optional display name from hub-catalog API */
  catalogName?: string;
}
