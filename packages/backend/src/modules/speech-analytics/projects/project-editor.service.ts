import { createHash } from 'node:crypto';
import {
  defaultSaProjectConfig,
  isSaIndustryTemplateId,
  type SaProjectConfigV1,
} from '@krasterisk/shared';
import { UserLevel } from '../../users/user.model';

export class ProjectEditorError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

export type EditorProjectState = {
  draft: SaProjectConfigV1;
  draftRevision: number;
  /** Published config used by runs; null until first publish. */
  published: SaProjectConfigV1 | null;
  /** Metric-set version stamp (D-26); grows only for metrics/topics/prompt/scales. */
  versionNo: number;
  versions: Array<{ versionNo: number; config: SaProjectConfigV1 }>;
};

export function emptyEditorState(seed?: Partial<SaProjectConfigV1>): EditorProjectState {
  return {
    draft: { ...defaultSaProjectConfig(), ...seed },
    draftRevision: 1,
    published: null,
    versionNo: 0,
    versions: [],
  };
}

/** Publishers / deleters: cabinet ADMIN, SUPERVISOR, and platform SUPERADMIN (D-27). */
export function canPublishProject(level: number): boolean {
  return level === UserLevel.ADMIN
    || level === UserLevel.SUPERVISOR
    || level === UserLevel.SUPERADMIN;
}

export function canDeleteProject(level: number): boolean {
  return canPublishProject(level);
}

/** Fields that bump the metric-set stamp (D-26). */
export function metricSetStampPayload(config: SaProjectConfigV1): unknown {
  return {
    customMetrics: config.customMetrics,
    topics: config.topics,
    systemPrompt: config.systemPrompt,
    hiddenDefaultScales: [...config.hiddenDefaultScales].sort(),
  };
}

export function metricSetStamp(config: SaProjectConfigV1): string {
  return createHash('sha256')
    .update(JSON.stringify(metricSetStampPayload(config)))
    .digest('hex');
}

export function stampChanged(
  published: SaProjectConfigV1 | null,
  draft: SaProjectConfigV1,
): boolean {
  if (!published) return true;
  return metricSetStamp(published) !== metricSetStamp(draft);
}

export function assertValidTemplate(config: SaProjectConfigV1): void {
  if (!isSaIndustryTemplateId(config.templateId)) {
    throw new ProjectEditorError('invalid_template', 400, String(config.templateId));
  }
}

/** Draft save does not change the published version used by runs (D-26). */
export function saveDraft(
  state: EditorProjectState,
  expectedRevision: number,
  config: SaProjectConfigV1,
): EditorProjectState {
  assertValidTemplate(config);
  if (state.draftRevision !== expectedRevision) {
    throw new ProjectEditorError('stale_draft', 409);
  }
  return {
    ...state,
    draft: { ...config },
    draftRevision: state.draftRevision + 1,
  };
}

/**
 * Publish draft (D-26).
 * Version stamp grows only when metrics, topics, prompt, or visible default scales change.
 * Webhook / digest / alert / budget do not bump it.
 */
export function publishDraft(
  state: EditorProjectState,
  level: number,
): EditorProjectState {
  if (!canPublishProject(level)) {
    throw new ProjectEditorError('resource_permission_denied', 403);
  }
  assertValidTemplate(state.draft);
  const published = { ...state.draft };
  const bump = stampChanged(state.published, published);
  const nextVersionNo = bump
    ? (state.published ? state.versionNo + 1 : Math.max(1, state.versionNo + 1))
    : state.versionNo;

  if (!bump && state.published) {
    // Non-stamp publish updates the active published config in place.
    const versions = state.versions.map((row) => (
      row.versionNo === state.versionNo
        ? { versionNo: row.versionNo, config: published }
        : row
    ));
    return {
      ...state,
      published,
      versionNo: nextVersionNo,
      versions,
    };
  }

  return {
    ...state,
    published,
    versionNo: nextVersionNo,
    versions: [...state.versions, { versionNo: nextVersionNo, config: published }],
  };
}

/** Cannot re-activate an older version as current — restore via draft + new publish (D-26). */
export function activateVersion(
  _state: EditorProjectState,
  _versionNo: number,
): EditorProjectState {
  throw new ProjectEditorError('cannot_reactivate_version', 400);
}

/**
 * Nest injectable surface — DB/endpoint wiring continues in task 2.
 */
export class ProjectEditorService {
  canPublish(level: number): boolean {
    return canPublishProject(level);
  }

  canDelete(level: number): boolean {
    return canDeleteProject(level);
  }

  saveDraftState(
    state: EditorProjectState,
    expectedRevision: number,
    config: SaProjectConfigV1,
  ): EditorProjectState {
    return saveDraft(state, expectedRevision, config);
  }

  publishState(state: EditorProjectState, level: number): EditorProjectState {
    return publishDraft(state, level);
  }

  activateVersionState(state: EditorProjectState, versionNo: number): EditorProjectState {
    return activateVersion(state, versionNo);
  }
}
