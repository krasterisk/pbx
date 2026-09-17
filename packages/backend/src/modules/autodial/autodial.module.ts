import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AmiModule } from '../ami/ami.module';
import { AriModule } from '../ari/ari.module';
import { CallCenterModule } from '../callcenter/callcenter.module';
import { CloudAdminModule } from '../cloud-admin/cloud-admin.module';
import { LoggerModule } from '../logger/logger.module';
import { ReportsCdrModule } from '../reports/cdr/reports-cdr.module';
import { Cdr } from '../reports/cdr/cdr.model';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { AcAttempt } from './models/ac-attempt.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcBase } from './models/ac-base.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcContact } from './models/ac-contact.model';
import { AcDailyCampaignStats } from './models/ac-daily-campaign-stats.model';
import { AcDnc } from './models/ac-dnc.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AcImportRun } from './models/ac-import-run.model';
import { AcSchedule } from './models/ac-schedule.model';
import { AcTask } from './models/ac-task.model';
import { AutodialAiAdapter } from './autodial-ai.adapter';
import { AutodialAttemptService } from './autodial-attempt.service';
import { AutodialBasesController } from './autodial-bases.controller';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialCampaignsController } from './autodial-campaigns.controller';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialDialplanService } from './autodial-dialplan.service';
import { AutodialDncService } from './autodial-dnc.service';
import { AutodialImportService } from './autodial-import.service';
import { AutodialInternalController } from './autodial-internal.controller';
import { AutodialOriginatorService } from './autodial-originator.service';
import { AutodialPacerService } from './autodial-pacer.service';
import { AutodialReconcilerService } from './autodial-reconciler.service';
import { AutodialReportsController } from './autodial-reports.controller';
import { AutodialReportsService } from './autodial-reports.service';
import { AutodialRollupService } from './autodial-rollup.service';
import { AutodialSchedulerService } from './autodial-scheduler.service';
import { AutodialSseController } from './autodial-sse.controller';
import { AutodialStateService } from './autodial-state.service';

/**
 * Autodial (Автообзвон) — commercial outbound dialer module.
 *
 * Dials over ARI rather than AMI Originate: the dialer picks the channel id, so
 * every event correlates to an attempt without guessing, and pre-answer causes
 * arrive intact.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      AcBase,
      AcBaseField,
      AcContact,
      AcContactPhone,
      AcImportProfile,
      AcImportRun,
      AcCampaign,
      AcSchedule,
      AcDnc,
      AcTask,
      AcAttempt,
      AcDailyCampaignStats,
      PsEndpoint,
      Cdr,
    ]),
    AmiModule,
    AriModule,
    CallCenterModule,
    CloudAdminModule,
    AiPlatformModule,
    LoggerModule,
    ReportsCdrModule,
  ],
  controllers: [
    AutodialBasesController,
    AutodialCampaignsController,
    AutodialReportsController,
    AutodialSseController,
    AutodialInternalController,
  ],
  providers: [
    AutodialBasesService,
    AutodialImportService,
    AutodialCampaignsService,
    AutodialDncService,
    AutodialDialplanService,
    AutodialSchedulerService,
    AutodialStateService,
    AutodialAttemptService,
    AutodialOriginatorService,
    AutodialPacerService,
    AutodialReconcilerService,
    AutodialReportsService,
    AutodialRollupService,
    AutodialAiAdapter,
  ],
  exports: [AutodialBasesService, AutodialCampaignsService, AutodialStateService],
})
export class AutodialModule {}
