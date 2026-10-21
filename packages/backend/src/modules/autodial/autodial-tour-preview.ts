import { BadRequestException } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { AUTODIAL_DISPOSITIONS, type AutodialDisposition, type AutodialCampaignStatus } from '@krasterisk/shared';

export interface AutodialTourCounts {
  tasks: number; clients: number; numbers: number; new_tasks: number;
  rearmed_tasks: number; carried_tasks: number; excluded_dnc_numbers: number;
  untouched_tasks: number; active_tasks: number;
}
export interface AutodialTourPreview {
  campaign_uid: number; campaign_revision: number; base_revision: number; tour_no: number;
  status: AutodialCampaignStatus; checked_at: string; advisory: true;
  include_dispositions: AutodialDisposition[];
  totals: AutodialTourCounts;
  by_disposition: Array<{ disposition: string; tasks: number; clients: number; numbers: number; excluded_dnc_numbers: number }>;
}

export function parseTourDispositions(raw: unknown): AutodialDisposition[] {
  if (raw === undefined || raw === '') return [];
  if (typeof raw !== 'string' || raw.length > 512) throw new BadRequestException({ code: 'AC_TOUR_SELECTION_INVALID' });
  const values = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
  if (values.length > AUTODIAL_DISPOSITIONS.length || values.some((value) => !AUTODIAL_DISPOSITIONS.includes(value as AutodialDisposition))) {
    throw new BadRequestException({ code: 'AC_TOUR_SELECTION_INVALID' });
  }
  return values as AutodialDisposition[];
}

/** Aggregate in SQL: a large base must never travel through Node for a preview. */
export async function previewAutodialTour(db: Sequelize, input: {
  userUid: number; campaignUid: number; baseUid: number; campaignRevision: number;
  baseRevision: number; tourNo: number; status: AutodialCampaignStatus; dispositions: AutodialDisposition[];
}): Promise<AutodialTourPreview> {
  const selected = input.dispositions.length ? 't.last_disposition IN (:dispositions)' : '1 = 0';
  const rows = await db.query<Record<string, string | number | null>>(`
    WITH audience AS (
      SELECT p.uid AS phone_uid, p.contact_uid,
        COALESCE(NULLIF(p.canonical_phone, ''), p.normalized) AS dial_number,
        t.uid AS task_uid, t.status AS task_status, COALESCE(t.last_disposition, 'new') AS disposition,
        CASE WHEN t.uid IS NULL THEN 'new'
          WHEN ${selected} AND t.status NOT IN ('leased', 'dialing') THEN 'rearmed'
          WHEN t.status = 'pending' THEN 'carried' ELSE 'untouched' END AS category,
        CASE WHEN EXISTS (SELECT 1 FROM ac_dnc d WHERE d.vpbx_user_uid = :userUid
          AND d.normalized_phone = p.canonical_phone
          AND (d.expires_at IS NULL OR d.expires_at > CURRENT_TIMESTAMP)
          AND (d.scope = 'global' OR (d.scope = 'base' AND d.scope_uid = :baseUid)
            OR (d.scope = 'campaign' AND d.scope_uid = :campaignUid))) THEN 1 ELSE 0 END AS blocked
      FROM ac_contact_phones p JOIN ac_contacts c ON c.uid = p.contact_uid AND c.vpbx_user_uid = :userUid
      LEFT JOIN ac_tasks t ON t.phone_uid = p.uid AND t.campaign_uid = :campaignUid AND t.vpbx_user_uid = :userUid
      WHERE p.base_uid = :baseUid AND p.normalized <> ''
    )
    SELECT 'total' AS group_kind, '' AS disposition,
      COUNT(CASE WHEN blocked = 0 AND category <> 'untouched' THEN phone_uid END) AS tasks,
      COUNT(DISTINCT CASE WHEN blocked = 0 AND category <> 'untouched' THEN contact_uid END) AS clients,
      COUNT(DISTINCT CASE WHEN blocked = 0 AND category <> 'untouched' THEN dial_number END) AS numbers,
      COUNT(CASE WHEN blocked = 0 AND category = 'new' THEN phone_uid END) AS new_tasks,
      COUNT(CASE WHEN blocked = 0 AND category = 'rearmed' THEN phone_uid END) AS rearmed_tasks,
      COUNT(CASE WHEN blocked = 0 AND category = 'carried' THEN phone_uid END) AS carried_tasks,
      COUNT(DISTINCT CASE WHEN blocked = 1 AND category <> 'untouched' THEN dial_number END) AS excluded_dnc_numbers,
      COUNT(CASE WHEN category = 'untouched' THEN phone_uid END) AS untouched_tasks,
      COUNT(CASE WHEN task_status IN ('leased', 'dialing') THEN task_uid END) AS active_tasks FROM audience
    UNION ALL
    SELECT 'disposition', disposition,
      COUNT(CASE WHEN blocked = 0 THEN task_uid END),
      COUNT(DISTINCT CASE WHEN blocked = 0 THEN contact_uid END),
      COUNT(DISTINCT CASE WHEN blocked = 0 THEN dial_number END), 0, 0, 0,
      COUNT(DISTINCT CASE WHEN blocked = 1 THEN dial_number END), 0, 0
    FROM audience WHERE task_uid IS NOT NULL AND task_status NOT IN ('leased', 'dialing') GROUP BY disposition`, {
    replacements: { userUid: input.userUid, campaignUid: input.campaignUid, baseUid: input.baseUid,
      ...(input.dispositions.length ? { dispositions: input.dispositions } : {}) }, type: QueryTypes.SELECT,
  });
  const total = rows.find((row) => row.group_kind === 'total') ?? {};
  const number = (row: Record<string, string | number | null>, field: string) => Number(row[field] ?? 0);
  return { campaign_uid: input.campaignUid, campaign_revision: input.campaignRevision,
    base_revision: input.baseRevision, tour_no: input.tourNo, status: input.status,
    checked_at: new Date().toISOString(), advisory: true, include_dispositions: input.dispositions,
    totals: { tasks: number(total, 'tasks'), clients: number(total, 'clients'), numbers: number(total, 'numbers'),
      new_tasks: number(total, 'new_tasks'), rearmed_tasks: number(total, 'rearmed_tasks'),
      carried_tasks: number(total, 'carried_tasks'), excluded_dnc_numbers: number(total, 'excluded_dnc_numbers'),
      untouched_tasks: number(total, 'untouched_tasks'), active_tasks: number(total, 'active_tasks') },
    by_disposition: rows.filter((row) => row.group_kind === 'disposition').map((row) => ({
      disposition: String(row.disposition), tasks: number(row, 'tasks'), clients: number(row, 'clients'),
      numbers: number(row, 'numbers'), excluded_dnc_numbers: number(row, 'excluded_dnc_numbers'),
    })),
  };
}
