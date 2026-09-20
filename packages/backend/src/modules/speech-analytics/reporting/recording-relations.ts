export type RelationReadInput = {
  sourceKind: 'cdr' | 'callcenter' | 'autodial' | 'external';
  callPermission: boolean;
  analyticsPermission: boolean;
  transcriptPermission: boolean;
  audioPermission: boolean;
  snippet?: string | null;
};

export type RelationReadResult = {
  visible: boolean;
  statusLink: boolean;
  snippet: string | null;
  audio: boolean;
};

export function readInternalRelation(input: RelationReadInput): RelationReadResult {
  const allowed = input.callPermission && input.analyticsPermission;
  if (!allowed) {
    return { visible: false, statusLink: false, snippet: null, audio: false };
  }
  return {
    visible: true,
    statusLink: true,
    snippet: input.transcriptPermission ? (input.snippet ?? null) : null,
    audio: input.audioPermission === true,
  };
}
