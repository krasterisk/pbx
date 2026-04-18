import { memo } from 'react';

/* ────────────────────────────────────────────────────────────── */
/*  Loader — spinner for non-card loading states                 */
/* ────────────────────────────────────────────────────────────── */

interface LoaderProps {
  /** Size in pixels. Default: 24 */
  size?: number;
  /** CSS class for the container */
  className?: string;
  /** Optional label text */
  label?: string;
}

/**
 * Loader — animated spinner with optional label.
 *
 * Usage:
 *   <Loader />
 *   <Loader size={32} label="Загрузка..." />
 */
export const Loader = memo(({ size = 24, className, label }: LoaderProps) => {
  return (
    <div className={`flex items-center justify-center gap-2 ${className || ''}`}>
      <svg
        className="animate-spin text-primary"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
});
Loader.displayName = 'Loader';

/* ────────────────────────────────────────────────────────────── */
/*  PageLoader — full-area centered loader                       */
/* ────────────────────────────────────────────────────────────── */

interface PageLoaderProps {
  label?: string;
  className?: string;
}

export const PageLoader = memo(({ label, className }: PageLoaderProps) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-3 ${className || ''}`}>
      <Loader size={32} />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
});
PageLoader.displayName = 'PageLoader';
