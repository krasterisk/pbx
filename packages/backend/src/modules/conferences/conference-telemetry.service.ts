import { Injectable } from '@nestjs/common';
import {
  QUALITY_LIMITATION_REASONS,
  type ConferenceTelemetryDto,
  type QualityLimitationReason,
} from './dto/conference-telemetry.dto';

const TELEMETRY_TTL_MS = 60_000;

const QUALITY_REASONS = new Set<string>(QUALITY_LIMITATION_REASONS);

interface TelemetryEntry {
  fields: ConferenceTelemetryDto;
  seenAt: number;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

@Injectable()
export class ConferenceTelemetryService {
  private readonly store = new Map<string, TelemetryEntry>();

  ingest(roomUid: number, ref: string, raw: Record<string, unknown>): ConferenceTelemetryDto {
    const fields: ConferenceTelemetryDto = {};
    const reason = raw?.qualityLimitationReason;
    if (typeof reason === 'string' && QUALITY_REASONS.has(reason)) {
      fields.qualityLimitationReason = reason as QualityLimitationReason;
    }
    if (isNonNegativeFinite(raw?.packetsLost)) {
      fields.packetsLost = raw.packetsLost;
    }
    if (isNonNegativeFinite(raw?.totalFreezesDuration)) {
      fields.totalFreezesDuration = raw.totalFreezesDuration;
    }
    this.store.set(this.key(roomUid, ref), { fields, seenAt: Date.now() });
    return fields;
  }

  get(roomUid: number, ref: string): ConferenceTelemetryDto | null {
    const key = this.key(roomUid, ref);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.seenAt > TELEMETRY_TTL_MS) {
      this.store.delete(key);
      return null;
    }
    return entry.fields;
  }

  private key(roomUid: number, ref: string): string {
    return `${roomUid}:${ref}`;
  }
}
