import { describe, it, expect } from 'vitest';
import {
  BULK_DELETE_PREVIEW_LIMIT,
  buildBulkDeletePreview,
} from './bulkDeletePreview';

describe('buildBulkDeletePreview', () => {
  it('single selection', () => {
    expect(
      buildBulkDeletePreview({
        labels: ['Alpha'],
        allMatching: false,
        hasFilter: false,
        filteredTotal: 1,
      }),
    ).toEqual({
      mode: 'single',
      count: 1,
      previewLabels: ['Alpha'],
      remaining: 0,
    });
  });

  it('lists up to preview limit without truncation', () => {
    const labels = Array.from({ length: BULK_DELETE_PREVIEW_LIMIT }, (_, i) => `r${i}`);
    const preview = buildBulkDeletePreview({
      labels,
      allMatching: false,
      hasFilter: false,
      filteredTotal: labels.length,
    });
    expect(preview.mode).toBe('list');
    expect(preview.previewLabels).toHaveLength(BULK_DELETE_PREVIEW_LIMIT);
    expect(preview.remaining).toBe(0);
  });

  it('truncates when more than preview limit', () => {
    const labels = Array.from({ length: 15 }, (_, i) => `r${i}`);
    const preview = buildBulkDeletePreview({
      labels,
      allMatching: false,
      hasFilter: false,
      filteredTotal: 15,
    });
    expect(preview.mode).toBe('truncated');
    expect(preview.count).toBe(15);
    expect(preview.previewLabels).toHaveLength(BULK_DELETE_PREVIEW_LIMIT);
    expect(preview.remaining).toBe(15 - BULK_DELETE_PREVIEW_LIMIT);
  });

  it('allMatching skips listing labels', () => {
    const labels = Array.from({ length: 200 }, (_, i) => `r${i}`);
    const preview = buildBulkDeletePreview({
      labels,
      allMatching: true,
      hasFilter: true,
      filteredTotal: 200,
    });
    expect(preview.mode).toBe('allMatching');
    expect(preview.count).toBe(200);
    expect(preview.previewLabels).toEqual([]);
  });
});
