/**
 * JWT carries vpbx_user_uid, not tenants.id.
 * Resolve a real tenants.id for a tenant ADMIN. Never invent a partition
 * from vpbx_user_uid (including 0) when no cabinet row exists.
 * Platform SUPERADMIN selects a cabinet explicitly; this helper is not for that.
 */
export type JwtTenantHints = {
  tenant_id?: number;
  vpbx_user_uid?: number;
};

export async function resolveTenantIdFromJwt(
  user: JwtTenantHints | undefined,
  findByVpbxUid: (vpbxUserUid: number) => Promise<{ id: number } | null | undefined>,
): Promise<number | null> {
  const claimed = user?.tenant_id;
  if (Number.isSafeInteger(claimed) && claimed! > 0) {
    return claimed!;
  }

  const vpbx = user?.vpbx_user_uid;
  if (!Number.isSafeInteger(vpbx) || vpbx! < 0) {
    return null;
  }

  const tenant = await findByVpbxUid(vpbx!);
  const id = tenant?.id;
  if (Number.isSafeInteger(id) && id! > 0) {
    return id!;
  }

  return null;
}
