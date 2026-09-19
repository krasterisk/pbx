import { assertAssetReadable, type AssetState } from './asset-state-machine';

export const AI_RANGE_MAX_BYTES = 8 * 1024 * 1024;

export function authorizeRange(input: {
  assetTenant: number;
  requestTenant: number;
  state: AssetState;
  objectBytes: number;
  start: number;
  end: number;
}): { start: number; end: number } {
  if (input.assetTenant !== input.requestTenant) {
    throw Object.assign(new Error('range tenant mismatch'), { code: 'range_denied', status: 403 });
  }
  assertAssetReadable(input.state);
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end) || input.start < 0 || input.end < input.start) {
    throw Object.assign(new Error('range is invalid'), { code: 'range_denied', status: 416 });
  }
  if (input.end >= input.objectBytes || (input.end - input.start + 1) > AI_RANGE_MAX_BYTES) {
    throw Object.assign(new Error('range is denied'), { code: 'range_denied', status: 416 });
  }
  return { start: input.start, end: input.end };
}
