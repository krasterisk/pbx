import { ForbiddenException } from '@nestjs/common';
import type { JwtPayloadUser } from '../../auth/auth.service';
import type { DashboardAccessService } from '../../dashboard/dashboard-access.service';
import type { ProductAccessService } from '../../product-access/product-access.service';

export async function transcriptContext(
  access: DashboardAccessService,
  products: ProductAccessService,
  user: JwtPayloadUser,
) {
  const ctx = await access.resolve(user, 'cdr');
  if (
    ![...ctx.pages].some((page) =>
      /^speech[-_]analytics[-_]conversations$/.test(page),
    )
  )
    throw new ForbiddenException('Analytics access required');
  if (!(await products.decide(ctx.tenant, 'speech_analytics')).allowed)
    throw new ForbiddenException('Speech analytics is not entitled');
  return ctx;
}

/** One source policy for reading and searching. All placeholders are server-bound. */
export const TRANSCRIPT_SOURCE = `FROM sa_recording_relations r
 JOIN sa_recordings rec ON rec.id=r.recording_id AND rec.vpbx_user_uid=r.vpbx_user_uid
 JOIN sa_projects p ON p.id=rec.project_id AND p.vpbx_user_uid=r.vpbx_user_uid AND p.status='active'
 JOIN sa_project_members m ON m.project_id=p.id AND m.vpbx_user_uid=r.vpbx_user_uid AND m.user_id=:userId AND m.can_transcript=TRUE AND m.role IN ('owner','analyst','viewer')
 JOIN sa_analysis_runs a ON a.recording_id=rec.id AND a.vpbx_user_uid=r.vpbx_user_uid
 JOIN sa_project_versions v ON v.id=a.project_version_id AND v.vpbx_user_uid=r.vpbx_user_uid AND v.project_id=p.id
 JOIN sa_results result ON result.id=a.result_id AND result.vpbx_user_uid=r.vpbx_user_uid AND result.run_id=a.id
 JOIN sa_transcripts t ON t.id=a.transcript_id AND t.vpbx_user_uid=r.vpbx_user_uid AND t.asset_id=rec.asset_id
 JOIN ai_media_assets asset ON asset.id=rec.asset_id AND asset.vpbx_user_uid=r.vpbx_user_uid AND asset.deleted_at IS NULL AND asset.state='ready' AND (asset.retention_at IS NULL OR asset.retention_at > :now)
 WHERE r.vpbx_user_uid=:tenant AND r.source_kind='cdr' AND rec.integration_principal_id='system:hangup'
 AND a.state IN ('completed','succeeded')`;
