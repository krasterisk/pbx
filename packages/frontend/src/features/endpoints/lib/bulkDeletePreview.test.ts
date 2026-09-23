import { describe, it, expect } from 'vitest';
import {
  BULK_DELETE_PREVIEW_LIMIT,
  buildBulkDeletePreview,
} from './bulkDeletePreview';

describe('buildBulkDeletePreview', () => {
  it('single selection', () => {
    const preview = buildBulkDeletePreview({
      extensions: ['100'],
      allMatching: false,
      hasFilter: false,
      filteredTotal: 1,
    });
    expect(preview).toEqual({
      mode: 'single',
      count: 1,
      previewExtensions: ['100'],
      remaining: 0,
    });
  });

  it('lists up to preview limit without truncation', () => {
    const extensions = Array.from({ length: BULK_DELETE_PREVIEW_LIMIT }, (_, i) => String(100 + i));
    const preview = buildBulkDeletePreview({
      extensions,
      allMatching: false,
      hasFilter: false,
      filteredTotal: extensions.length,
    });
    expect(preview.mode).toBe('list');
    expect(preview.previewExtensions).toHaveLength(BULK_DELETE_PREVIEW_LIMIT);
    expect(preview.remaining).toBe(0);
  });

  it('truncates when more than preview limit', () => {
    const extensions = Array.from({ length: 15 }, (_, i) => String(100 + i));
    const preview = buildBulkDeletePreview({
      extensions,
      allMatching: false,
      hasFilter: false,
      filteredTotal: 15,
    });
    expect(preview.mode).toBe('truncated');
    expect(preview.count).toBe(15);
    expect(preview.previewExtensions).toHaveLength(BULK_DELETE_PREVIEW_LIMIT);
    expect(preview.remaining).toBe(15 - BULK_DELETE_PREVIEW_LIMIT);
  });

  it('allMatching skips listing extensions', () => {
    const extensions = Array.from({ length: 200 }, (_, i) => String(100 + i));
    const preview = buildBulkDeletePreview({
      extensions,
      allMatching: true,
      hasFilter: true,
      filteredTotal: 200,
    });
    expect(preview.mode).toBe('allMatching');
    expect(preview.count).toBe(200);
    expect(preview.previewExtensions).toEqual([]);
  });
});
