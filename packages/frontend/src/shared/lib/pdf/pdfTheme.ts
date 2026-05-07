/**
 * Shared PDF theme for all KrAsterisk documents.
 * Uses standard PDF fonts (Helvetica covers basic Latin, Courier for monospace).
 *
 * NOTE: @react-pdf/renderer uses its own style system (similar to React Native).
 * All values are in pt by default.
 */

export const PDF_COLORS = {
  primary:    '#4F46E5',  // Indigo
  primaryLight: '#EEF2FF',
  text:       '#111827',
  muted:      '#6B7280',
  border:     '#E5E7EB',
  success:    '#059669',
  danger:     '#DC2626',
  bg:         '#FFFFFF',
  bgGray:     '#F9FAFB',
} as const;

export const PDF_FONTS = {
  regular: 'Helvetica',
  bold:    'Helvetica-Bold',
  mono:    'Courier',
} as const;
