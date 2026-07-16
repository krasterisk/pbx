import type { LicenseStatus } from '../types';

/**
 * Map tenant_modules.status (or absence) → Hub LicenseStatus.
 *
 * - active → active
 * - inactive / off → disabled (purchased/base but admin-off)
 * - missing / unknown → locked (not licensed → Marketplace Buy)
 */
export function mapTenantStatusToLicenseStatus(
  status: string | null | undefined,
): LicenseStatus {
  if (status == null || status === '' || status === 'missing') {
    return 'locked';
  }
  if (status === 'active' || status === 'trial') {
    return 'active';
  }
  if (status === 'inactive' || status === 'off' || status === 'expired') {
    return 'disabled';
  }
  return 'locked';
}
