import { getAuthApiBase } from '@/shared/api/apiBase';

/** Authenticated avatar URL for <img src> (JWT via ?token=). */
export function buildUserAvatarUrl(
  userId: number,
  avatar: string | null | undefined,
  accessToken: string | null | undefined,
): string | undefined {
  if (!avatar || !accessToken || !userId) return undefined;
  const base = getAuthApiBase();
  const v = encodeURIComponent(avatar);
  const token = encodeURIComponent(accessToken);
  return `${base}/users/${userId}/avatar?token=${token}&v=${v}`;
}
