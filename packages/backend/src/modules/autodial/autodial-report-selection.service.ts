import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Transaction } from 'sequelize';
import { AutodialAnalyticsService, autodialAnalyticsSchema } from './autodial-analytics.service';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialCampaignsService } from './autodial-campaigns.service';

const inputSchema = z.strictObject({ filter: autodialAnalyticsSchema,
  name: z.string().trim().min(1).max(128), preview_hash: z.string().regex(/^[a-f0-9]{64}$/) });

@Injectable()
export class AutodialReportSelectionService {
  constructor(private readonly analytics: AutodialAnalyticsService, private readonly bases: AutodialBasesService,
    private readonly campaigns: AutodialCampaignsService) {}

  private async snapshot(tenant: number, filter: unknown) {
    const parsed = autodialAnalyticsSchema.safeParse(filter);
    if (!parsed.success || parsed.data.campaign_uids?.length !== 1) throw new BadRequestException({ code: 'AC_SELECTION_ONE_CAMPAIGN' });
    const campaign = await this.campaigns.findOne(tenant, parsed.data.campaign_uids[0]);
    const base = await this.bases.findOne(tenant, campaign.base_uid);
    const ids = await this.analytics.selectedContactIds(tenant, parsed.data);
    const hash = createHash('sha256').update(JSON.stringify({ tenant, filter: parsed.data, ids,
      campaignRevision: campaign.revision, baseRevision: base.revision })).digest('hex');
    return { campaign, base, ids, hash };
  }

  async preview(tenant: number, filter: unknown) {
    const { campaign, base, ids, hash } = await this.snapshot(tenant, filter);
    return { campaign_uid: campaign.uid, base_uid: base.uid, contact_count: ids.length, preview_hash: hash, dnc_preserved: true };
  }

  async createBase(tenant: number, role: number, raw: unknown, transaction?: Transaction) {
    if (![0, 1, 3].includes(role)) throw new ForbiddenException({ code: 'AC_WRITE_FORBIDDEN' });
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_SELECTION_INVALID' });
    const snapshot = await this.snapshot(tenant, parsed.data.filter);
    if (snapshot.hash !== parsed.data.preview_hash) throw new ConflictException({ code: 'AC_SELECTION_CHANGED' });
    if (transaction) return this.bases.cloneContactsInTransaction(tenant, snapshot.base.uid, snapshot.ids, parsed.data.name,
      snapshot.base.revision, snapshot.campaign.uid, transaction);
    return this.bases.cloneContacts(tenant, snapshot.base.uid, snapshot.ids, parsed.data.name,
      snapshot.base.revision, snapshot.campaign.uid);
  }
}
