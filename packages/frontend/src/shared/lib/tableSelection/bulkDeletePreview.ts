/** Max labels listed in bulk-delete confirmation before truncating. */
export const BULK_DELETE_PREVIEW_LIMIT = 8;

export type BulkDeletePreviewMode = 'single' | 'list' | 'truncated' | 'allMatching';

export interface BulkDeletePreviewInput {
  /** Selected row labels (order preserved). */
  labels: string[];
  /** True when the user chose “select all matching filter”. */
  allMatching: boolean;
  /** True when search/filter is active (non-empty). */
  hasFilter: boolean;
  /** Total matching/filtered count when allMatching (for copy). */
  filteredTotal: number;
}

export interface BulkDeletePreview {
  mode: BulkDeletePreviewMode;
  count: number;
  /** Labels to show in the dialog body (empty for allMatching / may be truncated). */
  previewLabels: string[];
  /** How many more beyond previewLabels (only for truncated). */
  remaining: number;
}

/**
 * Build a safe confirmation preview for bulk delete.
 * Never returns hundreds of labels — caps at BULK_DELETE_PREVIEW_LIMIT.
 */
export function buildBulkDeletePreview(input: BulkDeletePreviewInput): BulkDeletePreview {
  const count = input.labels.length;

  if (input.allMatching && count > 0) {
    return {
      mode: 'allMatching',
      count: input.filteredTotal || count,
      previewLabels: [],
      remaining: 0,
    };
  }

  if (count <= 1) {
    return {
      mode: 'single',
      count,
      previewLabels: input.labels.slice(0, 1),
      remaining: 0,
    };
  }

  if (count <= BULK_DELETE_PREVIEW_LIMIT) {
    return {
      mode: 'list',
      count,
      previewLabels: [...input.labels],
      remaining: 0,
    };
  }

  return {
    mode: 'truncated',
    count,
    previewLabels: input.labels.slice(0, BULK_DELETE_PREVIEW_LIMIT),
    remaining: count - BULK_DELETE_PREVIEW_LIMIT,
  };
}
