export const QUALITY_LIMITATION_REASONS = ['none', 'cpu', 'bandwidth', 'other'] as const;

export type QualityLimitationReason = (typeof QUALITY_LIMITATION_REASONS)[number];

export type ConferenceTelemetryDto = {
  qualityLimitationReason?: QualityLimitationReason;
  packetsLost?: number;
  totalFreezesDuration?: number;
};
