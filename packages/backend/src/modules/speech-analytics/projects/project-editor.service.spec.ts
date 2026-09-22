import { UserLevel } from '../../users/user.model';
import {
  SA_INDUSTRY_TEMPLATES,
  defaultSaProjectConfig,
  type SaProjectConfigV1,
} from '@krasterisk/shared';
import {
  ProjectEditorError,
  activateVersion,
  canPublishProject,
  emptyEditorState,
  publishDraft,
  saveDraft,
} from './project-editor.service';

function withMetricEdit(base: SaProjectConfigV1): SaProjectConfigV1 {
  return {
    ...base,
    customMetrics: [
      ...base.customMetrics,
      {
        id: 'needs_analysis',
        name: 'Needs analysis',
        type: 'number',
        description: '0-100',
      },
    ],
  };
}

describe('project editor publishers (D-27)', () => {
  it('allows publish/delete for ADMIN, SUPERVISOR, and SUPERADMIN only', () => {
    expect(canPublishProject(UserLevel.ADMIN)).toBe(true);
    expect(canPublishProject(UserLevel.SUPERVISOR)).toBe(true);
    expect(canPublishProject(UserLevel.SUPERADMIN)).toBe(true);
    expect(canPublishProject(UserLevel.OPERATOR)).toBe(false);
    expect(canPublishProject(UserLevel.READONLY)).toBe(false);
  });
});

describe('project editor draft then publish (D-25, D-26)', () => {
  it('accepts every industry template id from D-25 including custom', () => {
    for (const templateId of SA_INDUSTRY_TEMPLATES) {
      const state = emptyEditorState({ templateId });
      const next = saveDraft(state, 1, { ...state.draft, templateId });
      expect(next.draft.templateId).toBe(templateId);
    }
    expect(() => saveDraft(
      emptyEditorState(),
      1,
      { ...defaultSaProjectConfig(), templateId: 'clinic' as SaProjectConfigV1['templateId'] },
    )).toThrow(ProjectEditorError);
  });

  it('saving draft does not change the published version used by runs', () => {
    let state = emptyEditorState();
    state = publishDraft(saveDraft(state, 1, withMetricEdit(state.draft)), UserLevel.ADMIN);
    const publishedBefore = structuredClone(state.published);
    const versionBefore = state.versionNo;

    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      systemPrompt: 'draft-only prompt change',
    });

    expect(state.published).toEqual(publishedBefore);
    expect(state.versionNo).toBe(versionBefore);
    expect(state.draft.systemPrompt).toBe('draft-only prompt change');
  });

  it('publishing after metric/topic/prompt/visible-scale change increments version stamp', () => {
    let state = emptyEditorState();
    state = publishDraft(saveDraft(state, 1, withMetricEdit(state.draft)), UserLevel.ADMIN);
    expect(state.versionNo).toBe(1);

    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      topics: [...state.draft.topics, 'retention'],
    });
    state = publishDraft(state, UserLevel.ADMIN);
    expect(state.versionNo).toBe(2);

    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      systemPrompt: 'new prompt',
    });
    state = publishDraft(state, UserLevel.ADMIN);
    expect(state.versionNo).toBe(3);

    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      hiddenDefaultScales: ['greeting_quality'],
    });
    state = publishDraft(state, UserLevel.ADMIN);
    expect(state.versionNo).toBe(4);
  });

  it('saving webhook/digest/alert/budget alone does not increment version stamp', () => {
    let state = emptyEditorState();
    state = publishDraft(saveDraft(state, 1, withMetricEdit(state.draft)), UserLevel.ADMIN);
    expect(state.versionNo).toBe(1);

    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      eventWebhook: {
        url: 'https://hooks.example/sa',
        headers: { 'X-Token': 'secret' },
        events: ['analysis.completed', 'budget.exceeded'],
      },
      digest: { ...state.draft.digest, enabled: true, integrationUids: [11] },
      alerts: { ...state.draft.alerts, enabled: true, integrationUids: [11, 12] },
      budget: { softLimit: 500 },
    });
    state = publishDraft(state, UserLevel.ADMIN);

    expect(state.versionNo).toBe(1);
    expect(state.published?.eventWebhook.url).toBe('https://hooks.example/sa');
    expect(state.published?.budget.softLimit).toBe(500);
    expect(state.published?.digest.integrationUids).toEqual([11]);
  });

  it('cannot activate an arbitrary older version as current', () => {
    let state = emptyEditorState();
    state = publishDraft(saveDraft(state, 1, withMetricEdit(state.draft)), UserLevel.ADMIN);
    state = saveDraft(state, state.draftRevision, {
      ...state.draft,
      systemPrompt: 'v2',
    });
    state = publishDraft(state, UserLevel.ADMIN);
    expect(state.versionNo).toBe(2);

    expect(() => activateVersion(state, 1)).toThrow(/cannot_reactivate_version/);
  });
});
