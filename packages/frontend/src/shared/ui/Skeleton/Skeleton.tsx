import { memo } from 'react';

/* ────────────────────────────────────────────────────────────── */
/*  Skeleton — animated placeholder for loading content          */
/* ────────────────────────────────────────────────────────────── */

interface SkeletonProps {
  className?: string;
  /** Width (CSS value). Default: '100%' */
  width?: string | number;
  /** Height (CSS value). Default: '1rem' */
  height?: string | number;
  /** Border radius. Default: '0.375rem' (rounded-md) */
  borderRadius?: string | number;
}

/**
 * Skeleton — animated pulse placeholder.
 *
 * Usage:
 *   <Skeleton width="60%" height="1rem" />
 *   <Skeleton className="h-10 w-full rounded-lg" />
 */
export const Skeleton = memo(({ className, width, height, borderRadius }: SkeletonProps) => {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  if (borderRadius) style.borderRadius = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  return (
    <div
      className={`animate-pulse bg-muted rounded-md ${className || ''}`}
      style={style}
    />
  );
});
Skeleton.displayName = 'Skeleton';

/* ────────────────────────────────────────────────────────────── */
/*  SkeletonText — multiple lines of skeleton text               */
/* ────────────────────────────────────────────────────────────── */

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText = memo(({ lines = 3, className }: SkeletonTextProps) => {
  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.75rem"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
});
SkeletonText.displayName = 'SkeletonText';

/* ────────────────────────────────────────────────────────────── */
/*  SkeletonCard — card-shaped skeleton placeholder              */
/* ────────────────────────────────────────────────────────────── */

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard = memo(({ className }: SkeletonCardProps) => {
  return (
    <div className={`border border-border rounded-xl p-4 space-y-3 bg-background ${className || ''}`}>
      <div className="flex items-center justify-between">
        <Skeleton width="45%" height="1rem" />
        <Skeleton width="4rem" height="1.5rem" borderRadius="9999px" />
      </div>
      <Skeleton width="70%" height="0.625rem" />
      <Skeleton width="50%" height="0.625rem" />
    </div>
  );
});
SkeletonCard.displayName = 'SkeletonCard';
