import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { callTranscriptSpeaker } from './call-transcript-speaker';
import type { CallTranscriptPage } from '@krasterisk/shared';
import type { JwtPayloadUser } from '../../auth/auth.service';
import { DashboardAccessService } from '../../dashboard/dashboard-access.service';
import { DashboardReadStore } from '../../dashboard/dashboard-read-store.service';
import { ProductAccessService } from '../../product-access/product-access.service';
import { ActionLog } from '../../logger/action-log.model';
import { callsWhere } from './calls-query';
import type { CallFact } from '../../calls/call-record';
import { TRANSCRIPT_SOURCE, transcriptContext } from './transcript-source';

type Cursor = { run: string; transcript: string; ordinal: number; id: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function readCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 512 || !/^[\w-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(
      Buffer.from(value, 'base64url').toString(),
    ) as Cursor;
    if (
      !uuid.test(cursor.run) ||
      !uuid.test(cursor.transcript) ||
      !uuid.test(cursor.id) ||
      !Number.isSafeInteger(cursor.ordinal) ||
      cursor.ordinal < 0
    )
      throw new Error();
    return cursor;
  } catch {
    throw new BadRequestException('Invalid transcript cursor');
  }
}
@Injectable()
export class CallTranscriptService {
  constructor(
    private readonly access: DashboardAccessService,
    private readonly store: DashboardReadStore,
    private readonly products: ProductAccessService,
    @InjectModel(ActionLog) private readonly audit: typeof ActionLog,
  ) {}

  async read(
    user: JwtPayloadUser,
    id: string,
    encodedCursor?: string,
    segmentId?: string,
  ): Promise<CallTranscriptPage> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    const cursor = readCursor(encodedCursor);
    if (segmentId && (!uuid.test(segmentId) || cursor))
      throw new BadRequestException('Invalid transcript segment');
    const ctx = await transcriptContext(this.access, this.products, user);
    try {
      return await this.store.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
        async (transaction) => {
          const filter = callsWhere(
            ctx.tenant,
            {},
            { from: 0, to: Date.now() + 1 },
            ctx.scope,
          );
          const [row] = await this.store.select<{
            payload: string;
            node_id: string;
          }>(
            `SELECT f.payload,c.node_id FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant WHERE ${filter.sql} AND c.call_key=:callId`,
            { ...filter.args, callId: id },
            transaction,
          );
          if (!row) throw new NotFoundException();
          const fact = JSON.parse(row.payload) as CallFact;
          const ids = [
            ...new Set([fact.linkedid, ...fact.uniqueids].filter(Boolean)),
          ];
          if (!ids.length || ids.length > 10000)
            throw new ServiceUnavailableException(
              'Call identity is incomplete',
            );
          // Current source of truth, not a possibly stale analytics badge in the projection.
          // A project membership is mandatory even for company administrators.
          const args = {
            tenant: ctx.tenant,
            userId: ctx.user.sub,
            node: row.node_id,
            ids,
            now: new Date(),
            ...(cursor
              ? { run: cursor.run, transcript: cursor.transcript }
              : {}),
          };
          const [run] = await this.store.select<{
            run_id: string;
            transcript_id: string;
            source_id: string;
          }>(
            `SELECT DISTINCT a.id AS run_id,a.transcript_id,a.created_at,r.source_id
           ${TRANSCRIPT_SOURCE} AND r.node_id=:node
           AND (r.source_id IN (:ids) OR r.linkedid IN (:ids))
           ${cursor ? 'AND a.id=:run AND a.transcript_id=:transcript' : ''}
           ORDER BY a.created_at DESC,a.id DESC LIMIT 1`,
            args,
            transaction,
          );
          const unavailable: CallTranscriptPage = {
            state: 'unavailable',
            callId: id,
            runId: null,
            transcriptId: null,
            segments: [],
            nextCursor: null,
          };
          if (!run) return unavailable;
          let startOrdinal: number | undefined;
          if (segmentId) {
            const [target] = await this.store.select<{
              ordinal: number | string;
            }>(
              'SELECT ordinal FROM sa_transcript_segments WHERE vpbx_user_uid=:tenant AND transcript_id=:transcript AND id=:segmentId',
              { tenant: ctx.tenant, transcript: run.transcript_id, segmentId },
              transaction,
            );
            if (!target)
              throw new NotFoundException(
                'Transcript segment is no longer available',
              );
            startOrdinal = Number(target.ordinal);
          }
          const segments = await this.store.select<{
            id: string;
            ordinal: number | string;
            start_ms: number | string;
            end_ms: number | string;
            speaker_role: string;
            text: string;
          }>(
            `SELECT id,ordinal,start_ms,end_ms,speaker_role,SUBSTRING(text,1,5001) AS text FROM sa_transcript_segments
           WHERE vpbx_user_uid=:tenant AND transcript_id=:transcript ${cursor ? 'AND (ordinal > :ordinal OR (ordinal=:ordinal AND id > :segmentId))' : startOrdinal !== undefined ? 'AND ordinal >= :startOrdinal' : ''}
           ORDER BY ordinal,id LIMIT 101`,
            {
              tenant: ctx.tenant,
              transcript: run.transcript_id,
              ...(startOrdinal !== undefined ? { startOrdinal } : {}),
              ...(cursor
                ? { ordinal: cursor.ordinal, segmentId: cursor.id }
                : {}),
            },
            transaction,
          );
          const page = segments.slice(0, 100),
            last = page.at(-1);
          await this.audit.create(
            {
              user_id: ctx.user.sub,
              user_uid: ctx.tenant,
              action: 'call_transcript_view',
              entity_type: 'call',
              entity_id: null,
              details: JSON.stringify({
                callId: id,
                runId: run.run_id,
                segments: page.length,
              }),
              status: 'success',
            },
            { transaction },
          );
          return {
            state: 'ready',
            callId: id,
            runId: run.run_id,
            transcriptId: run.transcript_id,
            recordingId: fact.recordings?.some(recording=>recording.id===run.source_id) ? run.source_id : null,
            segments: page.map((segment) => ({
              id: segment.id,
              ordinal: Number(segment.ordinal),
              startMs: Number(segment.start_ms),
              endMs: Number(segment.end_ms),
              speaker: callTranscriptSpeaker(segment.speaker_role),
              text: segment.text.slice(0, 5000),
              textTruncated: segment.text.length > 5000,
            })),
            nextCursor:
              segments.length > 100 && last
                ? Buffer.from(
                    JSON.stringify({
                      run: run.run_id,
                      transcript: run.transcript_id,
                      ordinal: Number(last.ordinal),
                      id: last.id,
                    }),
                  ).toString('base64url')
                : null,
          };
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Transcript is temporarily unavailable',
        { cause: error },
      );
    }
  }
}
