import { createHash, randomUUID } from 'node:crypto';
import {
  defaultSaProjectConfig, recordingBusinessKey, type SaProjectConfigV1,
} from '@krasterisk/shared';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

export type ProjectRow = {
  id: string;
  tenantUid: number;
  name: string;
  status: 'draft' | 'active' | 'archived';
  draftRevision: number;
  draftConfig: SaProjectConfigV1;
  activeVersionId: string | null;
  createdBy: number;
};

export type VersionRow = {
  id: string;
  tenantUid: number;
  projectId: string;
  versionNo: number;
  configDigest: string;
  config: SaProjectConfigV1;
};

export type MemberRow = {
  tenantUid: number;
  projectId: string;
  userId: number;
  role: 'owner' | 'analyst' | 'viewer';
  canAudio: boolean;
  canTranscript: boolean;
};

export type AnalyticsStores = {
  projects: Map<string, ProjectRow>;
  versions: Map<string, VersionRow>;
  members: Map<string, MemberRow>;
};

export function emptyAnalyticsStores(): AnalyticsStores {
  return { projects: new Map(), versions: new Map(), members: new Map() };
}

export function configDigest(config: SaProjectConfigV1): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export function createProject(input: {
  stores: AnalyticsStores;
  tenantUid: number;
  userId: number;
  name: string;
}): ProjectRow {
  if (input.tenantUid <= 0) throw new DomainError('tenant_mismatch', 404);
  const project: ProjectRow = {
    id: randomUUID(),
    tenantUid: input.tenantUid,
    name: input.name,
    status: 'draft',
    draftRevision: 1,
    draftConfig: defaultSaProjectConfig(),
    activeVersionId: null,
    createdBy: input.userId,
  };
  input.stores.projects.set(project.id, project);
  input.stores.members.set(`${project.id}:${input.userId}`, {
    tenantUid: input.tenantUid, projectId: project.id, userId: input.userId,
    role: 'owner', canAudio: true, canTranscript: true,
  });
  return project;
}

export function updateDraft(input: {
  stores: AnalyticsStores;
  tenantUid: number;
  projectId: string;
  expectedRevision: number;
  config: SaProjectConfigV1;
}): ProjectRow {
  const project = input.stores.projects.get(input.projectId);
  if (!project || project.tenantUid !== input.tenantUid) throw new DomainError('resource_not_found', 404);
  if (project.status === 'archived') throw new DomainError('project_archived', 409);
  if (project.draftRevision !== input.expectedRevision) throw new DomainError('stale_draft', 409);
  project.draftConfig = input.config;
  project.draftRevision += 1;
  return project;
}

export function publishProject(input: {
  stores: AnalyticsStores;
  tenantUid: number;
  projectId: string;
  userId: number;
  operationKey: string;
  published?: Map<string, string>;
}): VersionRow {
  const replay = input.published?.get(`${input.tenantUid}:${input.operationKey}`);
  if (replay) {
    const existing = input.stores.versions.get(replay);
    if (existing) return existing;
  }
  const project = input.stores.projects.get(input.projectId);
  if (!project || project.tenantUid !== input.tenantUid) throw new DomainError('resource_not_found', 404);
  const member = input.stores.members.get(`${input.projectId}:${input.userId}`);
  if (!member || member.role !== 'owner' || member.tenantUid !== input.tenantUid) {
    throw new DomainError('resource_permission_denied', 403);
  }
  const versionNo = [...input.stores.versions.values()]
    .filter(row => row.projectId === project.id).length + 1;
  const version: VersionRow = {
    id: randomUUID(),
    tenantUid: project.tenantUid,
    projectId: project.id,
    versionNo,
    configDigest: configDigest(project.draftConfig),
    config: { ...project.draftConfig },
  };
  input.stores.versions.set(version.id, version);
  project.activeVersionId = version.id;
  project.status = 'active';
  input.published?.set(`${input.tenantUid}:${input.operationKey}`, version.id);
  return version;
}

export function hashBusinessKey(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export { recordingBusinessKey };
