import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../project-engine';

const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const UNSAFE = /javascript:|function\s*\(|SELECT\s|DROP\s|https?:\/\//i;

export type MetricType = 'boolean' | 'number' | 'enum' | 'string';
export type MetricStatus = 'scored' | 'unknown' | 'not_applicable' | 'unscorable';
export type Polarity = 'positive' | 'negative' | 'informational';

export type MetricRubric = {
  key: string;
  displayName: string;
  type: MetricType;
  instructions: string;
  polarity: Polarity;
  weight: number;
  required: boolean;
  min?: number;
  max?: number;
  enumValues?: string[];
  scoreMap?: Record<string, number>;
};

export type MetricDefinition = {
  id: string;
  projectId: string;
  key: string;
  archivedAt: Date | null;
};

export type MetricStores = {
  definitions: Map<string, MetricDefinition>;
  revisions: Map<string, { id: string; definitionId: string; revision: number; digest: string; rubric: MetricRubric }>;
  published: Map<string, string>;
};

export function emptyMetricStores(): MetricStores {
  return { definitions: new Map(), revisions: new Map(), published: new Map() };
}

export function assertRubric(rubric: MetricRubric): void {
  if (!KEY.test(rubric.key)) throw new DomainError('metric_key_invalid', 422);
  if (UNSAFE.test(rubric.instructions) || UNSAFE.test(rubric.displayName)) {
    throw new DomainError('unsafe_expression', 422);
  }
  if (rubric.weight < 0) throw new DomainError('weight_invalid', 422);
  if (rubric.type === 'number') {
    if (rubric.min == null || rubric.max == null || !(rubric.max > rubric.min)) {
      throw new DomainError('range_invalid', 422);
    }
  }
  if (rubric.type === 'enum' && (!rubric.enumValues?.length)) {
    throw new DomainError('enum_invalid', 422);
  }
}

export function publishMetric(input: {
  stores: MetricStores;
  projectId: string;
  rubric: MetricRubric;
  operationKey: string;
}): { definitionId: string; revisionId: string; replay: boolean } {
  assertRubric(input.rubric);
  const replay = input.stores.published.get(input.operationKey);
  if (replay) {
    const revision = input.stores.revisions.get(replay);
    if (!revision) throw new DomainError('publish_conflict', 409);
    return { definitionId: revision.definitionId, revisionId: revision.id, replay: true };
  }
  const existing = [...input.stores.definitions.values()].find(row =>
    row.projectId === input.projectId && row.key === input.rubric.key && !row.archivedAt);
  if (existing) {
    const previous = [...input.stores.revisions.values()].find(row => row.definitionId === existing.id);
    if (previous && previous.rubric.type !== input.rubric.type) {
      throw new DomainError('type_mismatch', 409);
    }
  }
  const definitionId = existing?.id ?? randomUUID();
  if (!existing) {
    input.stores.definitions.set(definitionId, {
      id: definitionId, projectId: input.projectId, key: input.rubric.key, archivedAt: null,
    });
  }
  const revision = [...input.stores.revisions.values()].filter(row => row.definitionId === definitionId).length + 1;
  const id = randomUUID();
  input.stores.revisions.set(id, {
    id, definitionId, revision,
    digest: createHash('sha256').update(JSON.stringify(input.rubric)).digest('hex'),
    rubric: input.rubric,
  });
  input.stores.published.set(input.operationKey, id);
  return { definitionId, revisionId: id, replay: false };
}

export type ScoredMetric = {
  status: MetricStatus;
  boolValue?: boolean | null;
  numberValue?: number | null;
  normalised: number | null;
};

export function scoreMetric(rubric: MetricRubric, input: {
  speech: boolean;
  value?: boolean | number | string | null;
  applicable?: boolean;
  roleKnown?: boolean;
}): ScoredMetric {
  if (!input.speech) return { status: 'unscorable', normalised: null };
  if (input.applicable === false) return { status: 'not_applicable', normalised: null };
  if (input.applicable == null) return { status: 'unknown', normalised: null };
  if (rubric.polarity !== 'informational' && input.roleKnown === false) {
    return { status: 'unknown', normalised: null };
  }
  if (input.value == null) return { status: 'unknown', normalised: null };
  if (rubric.type === 'boolean') {
    const value = Boolean(input.value);
    return { status: 'scored', boolValue: value, normalised: value ? 100 : 0 };
  }
  if (rubric.type === 'number') {
    const value = Number(input.value);
    if (value < (rubric.min ?? 0) || value > (rubric.max ?? 0)) {
      throw new DomainError('range_invalid', 422);
    }
    const span = (rubric.max ?? 1) - (rubric.min ?? 0);
    const linear = ((value - (rubric.min ?? 0)) / span) * 100;
    return {
      status: 'scored',
      numberValue: value,
      normalised: rubric.polarity === 'negative' ? 100 - linear : linear,
    };
  }
  return { status: 'scored', normalised: null };
}

export function overallScore(rows: Array<{ weight: number; status: MetricStatus; normalised: number | null }>, threshold = 0.8) {
  const eligible = rows.filter(row => row.weight > 0 && row.status !== 'not_applicable');
  if (eligible.length === 0) return { overall: null, coverage: null, reason: 'no_applicable_metrics' };
  const scored = eligible.filter(row => row.status === 'scored' && row.normalised != null);
  const eligibleWeight = eligible.reduce((sum, row) => sum + row.weight, 0);
  const scoredWeight = scored.reduce((sum, row) => sum + row.weight, 0);
  const coverage = eligibleWeight === 0 ? null : scoredWeight / eligibleWeight;
  if (!coverage || coverage < threshold || scoredWeight === 0) {
    return { overall: null, coverage, reason: 'coverage_below_threshold' };
  }
  const overall = scored.reduce((sum, row) => sum + row.weight * (row.normalised ?? 0), 0) / scoredWeight;
  return { overall, coverage, reason: null };
}

const AST_FIELDS = new Set(['duration_ms', 'channels', 'direction', 'quality']);

export type ApplicabilityNode =
  | { op: 'all' | 'any'; nodes: ApplicabilityNode[] }
  | { op: 'not'; node: ApplicabilityNode }
  | { op: 'eq' | 'gt' | 'lt'; field: string; value: string | number };

function nodeCount(node: ApplicabilityNode): number {
  if (node.op === 'all' || node.op === 'any') {
    return 1 + node.nodes.reduce((sum, child) => sum + nodeCount(child), 0);
  }
  if (node.op === 'not') return 1 + nodeCount(node.node);
  return 1;
}

export function evalApplicability(node: ApplicabilityNode, metadata: Record<string, unknown>, depth = 0): boolean | null {
  if (depth > 4) throw new DomainError('applicability_too_deep', 422);
  if (nodeCount(node) > 32) throw new DomainError('applicability_too_large', 422);
  const count = JSON.stringify(node).length;
  if (count > 2048) throw new DomainError('applicability_too_large', 422);
  if (node.op === 'all') {
    const results = node.nodes.map(child => evalApplicability(child, metadata, depth + 1));
    if (results.some(result => result === false)) return false;
    if (results.some(result => result == null)) return null;
    return true;
  }
  if (node.op === 'any') {
    const results = node.nodes.map(child => evalApplicability(child, metadata, depth + 1));
    if (results.some(result => result === true)) return true;
    if (results.every(result => result === false)) return false;
    return null;
  }
  if (node.op === 'not') {
    const inner = evalApplicability(node.node, metadata, depth + 1);
    return inner == null ? null : !inner;
  }
  if (!AST_FIELDS.has(node.field)) throw new DomainError('applicability_field_denied', 422);
  const actual = metadata[node.field];
  if (actual == null) return null;
  if (node.op === 'eq') return actual === node.value;
  if (typeof actual !== 'number' || typeof node.value !== 'number') return null;
  return node.op === 'gt' ? actual > node.value : actual < node.value;
}
