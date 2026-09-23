/**
 * @deprecated Prefer `@/shared/lib/tableSelection`. Kept for endpoints tests/compat.
 */
export {
  BULK_DELETE_PREVIEW_LIMIT,
  buildBulkDeletePreview as buildBulkDeletePreviewShared,
} from '@/shared/lib/tableSelection';
export type {
  BulkDeletePreviewMode,
} from '@/shared/lib/tableSelection';

import {
  buildBulkDeletePreview as buildShared,
  type BulkDeletePreview as SharedPreview,
} from '@/shared/lib/tableSelection';

export interface BulkDeletePreviewInput {
  extensions: string[];
  allMatching: boolean;
  hasFilter: boolean;
  filteredTotal: number;
}

export interface BulkDeletePreview {
  mode: SharedPreview['mode'];
  count: number;
  previewExtensions: string[];
  remaining: number;
}

export function buildBulkDeletePreview(input: BulkDeletePreviewInput): BulkDeletePreview {
  const preview = buildShared({
    labels: input.extensions,
    allMatching: input.allMatching,
    hasFilter: input.hasFilter,
    filteredTotal: input.filteredTotal,
  });
  return {
    mode: preview.mode,
    count: preview.count,
    previewExtensions: preview.previewLabels,
    remaining: preview.remaining,
  };
}
