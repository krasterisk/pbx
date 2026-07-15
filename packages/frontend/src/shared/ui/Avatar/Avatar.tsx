import { memo, useMemo } from 'react';
import { cn } from '@/shared/ui/Dialog/Dialog';

const AVATAR_BG_TOKENS = [
  'var(--color-primary)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-destructive)',
] as const;

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export const Avatar = memo(function Avatar({ name, size = 36, className }: AvatarProps) {
  const initials = useMemo(() => initialsFromName(name), [name]);
  const bg = useMemo(
    () => AVATAR_BG_TOKENS[hashName(name) % AVATAR_BG_TOKENS.length],
    [name],
  );

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: bg,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
});
