import type { CallAnalytics, CallParty } from '@krasterisk/shared';
import { endpointExtension, type DashboardLeg } from './call-classifier';
import type { CallArtifacts, CallEvent, CallFact } from './call-record';
import { celTimestampExpression } from './cel-timestamp';
interface Reader {
  select<T>(sql: string, args?: Record<string, unknown>): Promise<T[]>;
  sequelize?: { getDialect(): string };
}
interface RelationRow {
  source_id: string;
  linkedid: string | null;
  recording_id: string;
  id: string;
  state: string;
  project_id: string;
  result_id: string | null;
}
export interface CallEnrichment {
  events: CallEvent[];
  artifacts: Map<string, CallArtifacts>;
  names: Map<string, { name: string | null; department: string | null }>;
}
/** Optional source adapters are selected from the installed schema, never from CC dependencies. */
export async function loadCallEnrichment(
  reader: Reader,
  tables: Set<string>,
  tenant: number,
  legs: DashboardLeg[],
  nodeId?: string,
): Promise<CallEnrichment> {
  const ids = [
    ...new Set(
      legs
        .flatMap((l) => [l.uniqueid, l.linkedid])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const artifacts = new Map<string, CallArtifacts>();
  const result: CallEnrichment = { events: [], artifacts, names: new Map() };
  if (!ids.length) return result;
  const add = (id: string, patch: CallArtifacts) =>
    artifacts.set(id, { ...artifacts.get(id), ...patch });
  // Preserve zone-less wall clocks; serialize native instant columns with an explicit UTC offset.
  if (tables.has('cel'))
    result.events = await reader.select<CallEvent>(
      `SELECT id,uniqueid,linkedid,eventtype,${await celTimestampExpression(reader)} AS eventtime,channame,exten,peer,appname,extra FROM cel WHERE uniqueid IN (:ids) OR linkedid IN (:ids) ORDER BY id LIMIT 100001`,
      { ids },
    );
  if (result.events.length > 100000)
    throw new Error('Call journey exceeds projection budget');
  if (tables.has('voicemail_messages')) {
    const rows = await reader.select<{ uniqueid: string }>(
      'SELECT uniqueid FROM voicemail_messages WHERE vpbx_user_uid=:tenant AND uniqueid IN (:ids)',
      { tenant, ids },
    );
    for (const row of rows)
      add(row.uniqueid, { voicemail: true, voicemailCallId: row.uniqueid });
  }
  if (tables.has('voice_robot_cdr')) {
    const rows = await reader.select<{
      call_uniqueid: string;
      robot_id: number;
      robot_name: string | null;
    }>(
      'SELECT DISTINCT call_uniqueid,robot_id,robot_name FROM voice_robot_cdr WHERE user_uid=:tenant AND call_uniqueid IN (:ids)',
      { tenant, ids },
    );
    for (const row of rows)
      add(row.call_uniqueid, {
        voiceRobot: true,
        robots: [
          ...(artifacts.get(row.call_uniqueid)?.robots || []),
          {
            kind: 'voiceRobot',
            id: String(row.robot_id),
            name: row.robot_name,
            number: null,
            department: null,
          },
        ],
      });
  }
  if (tables.has('ai_voice_sessions')) {
    const rows = await reader.select<{ channel_uniqueid: string }>(
      "SELECT DISTINCT channel_uniqueid FROM ai_voice_sessions WHERE vpbx_user_uid=:tenant AND channel_uniqueid IN (:ids) AND ingress_kind<>'browser_test'",
      { tenant, ids },
    );
    for (const row of rows) add(row.channel_uniqueid, { aiRobot: true });
  }
  if (
    nodeId && ['sa_recording_relations', 'sa_analysis_runs', 'sa_project_versions'].every(
      (table) => tables.has(table),
    )
  ) {
    const rows = await reader.select<RelationRow>(
      `SELECT r.source_id,r.linkedid,r.recording_id,a.id,a.state,a.result_id,v.project_id
      FROM sa_recording_relations r JOIN sa_analysis_runs a ON a.recording_id=r.recording_id AND a.vpbx_user_uid=r.vpbx_user_uid
      JOIN sa_project_versions v ON v.id=a.project_version_id AND v.vpbx_user_uid=r.vpbx_user_uid
      WHERE r.vpbx_user_uid=:tenant AND r.source_kind='cdr' AND r.node_id=:nodeId AND (r.source_id IN (:ids) OR r.linkedid IN (:ids))
      ORDER BY a.created_at DESC,a.id DESC LIMIT 20001`,
      { tenant, ids, nodeId },
    );
    if (rows.length > 20000)
      throw new Error('Analysis relations exceed projection budget');
    for (const row of rows) {
      const state: CallAnalytics['state'] =
        row.result_id && ['completed', 'succeeded'].includes(row.state)
          ? 'analyzed'
          : ['failed', 'partial', 'unscorable', 'cancelled'].includes(row.state)
            ? 'failed'
            : row.state === 'queued'
              ? 'queued'
              : 'running';
      for (const id of [row.source_id, row.linkedid].filter(
        (id): id is string => Boolean(id),
      )) {
        const previous = artifacts.get(id)?.analytics;
        if (
          !previous ||
          (previous.state !== 'analyzed' && state === 'analyzed')
        )
          add(id, {
            analytics: {
              state,
              recordingId: row.recording_id,
              runId: row.id,
              projectId: row.project_id,
            },
          });
      }
    }
  }
  if (tables.has('ps_endpoints')) {
    const rows = await reader.select<{
      id: string;
      callerid: string | null;
      department: string | null;
    }>(
      "SELECT id,callerid,department FROM ps_endpoints WHERE id LIKE :pattern ESCAPE '!'",
      { pattern: `%!_${tenant}` },
    );
    for (const row of rows) {
      const ext = endpointExtension(row.id, tenant);
      if (!ext) continue;
      const name =
        row.callerid?.match(/^\s*"([^"]+)"/)?.[1] ||
        row.callerid?.replace(/\s*<[^>]*>\s*$/, '').trim() ||
        null;
      result.names.set(`employee:${ext}`, {
        name,
        department: row.department || null,
      });
    }
  }
  if (tables.has('users')) {
    const rows = await reader.select<{ name: string; exten: string | null }>(
      'SELECT name,exten FROM users WHERE vpbx_user_uid=:tenant AND exten IS NOT NULL',
      { tenant },
    );
    for (const row of rows)
      if (row.exten && row.name)
        result.names.set(`employee:${row.exten}`, {
          name: row.name,
          department:
            result.names.get(`employee:${row.exten}`)?.department || null,
        });
  }
  if (tables.has('queue_table')) {
    const rows = await reader.select<{
      name: string;
      display_name: string | null;
    }>(
      'SELECT name,display_name FROM queue_table WHERE vpbx_user_uid=:tenant',
      { tenant },
    );
    for (const row of rows)
      if (row.display_name)
        result.names.set(
          `queue:${row.name.replace(new RegExp(`^q(.*)_${tenant}$`), '$1')}`,
          {
            name: row.display_name,
            department: null,
          },
        );
  }
  return result;
}
export function artifactsForCall(
  legs: DashboardLeg[],
  data: CallEnrichment,
): CallArtifacts {
  const result: CallArtifacts = {};
  for (const id of new Set(
    legs.flatMap((leg) => [leg.uniqueid, leg.linkedid]).filter(Boolean),
  )) {
    const value = data.artifacts.get(id!);
    if (!value) continue;
    result.voicemail ||= value.voicemail;
    result.aiRobot ||= value.aiRobot;
    result.voiceRobot ||= value.voiceRobot;
    result.voicemailCallId ||= value.voicemailCallId;
    if (value.robots)
      result.robots = [...(result.robots || []), ...value.robots];
    if (
      value.analytics &&
      (!result.analytics || result.analytics.state !== 'analyzed')
    )
      result.analytics = value.analytics;
  }
  return result;
}
export function enrichCallNames(call: CallFact, data: CallEnrichment): void {
  const enrich = (party: CallParty | null) => {
    const name = party && data.names.get(`${party.kind}:${party.id}`);
    if (party && name) Object.assign(party, name);
  };
  for (const party of [call.caller, call.recipient, ...call.participants])
    enrich(party);
  for (const step of call.journey) {
    enrich(step.actor);
    enrich(step.target);
  }
  for (const node of call.route?.nodes || [])
    for (const step of node.steps) {
      enrich(step.actor);
      enrich(step.target);
    }
}
