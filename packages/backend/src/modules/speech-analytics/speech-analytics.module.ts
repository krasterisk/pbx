import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiJobsModule } from '../ai-jobs/ai-jobs.module';
import { MediaAssetsModule } from '../media-assets/media-assets.module';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { AiMediaAsset, AiUpload } from '../media-assets/media-asset.models';
import { IntegrationGrant } from '../integration-credentials/integration-credential.models';
import {
  SaAnalysisRun, SaProject, SaProjectMember, SaProjectVersion, SaRecording, SaResult,
  SaTranscript, SaTranscriptSegment,
} from './speech-analytics.models';
import {
  SaHumanReview, SaMetricDefinition, SaMetricRevision, SaMetricValue,
  SaProjectVersionMetric, SaTranscriptCorrection,
} from './metrics/metric.models';
import {
  SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem, SaRecordingRelation,
  SaReportDefinition, SaReportRun, SaReportSchedule, SaReportSnapshotItem, SaTenantCapturePolicy,
} from './reporting/reporting.models';
import { SpeechAnalyticsService } from './speech-analytics.service';
import { SaMetricsService } from './metrics/metrics.service';
import { SaReportingService } from './reporting/reporting.service';
import { SaJournalService } from './journal/journal.service';
import { SaProjectResolver } from './sa-project.resolver';
import { SpeechAnalyticsJwtController } from './speech-analytics-jwt.controller';
import { SpeechAnalyticsPublicController } from './speech-analytics-public.controller';
import { User } from '../users/user.model';
import { NumberList } from '../numbers/number-list.model';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    AiJobsModule,
    MediaAssetsModule,
    SequelizeModule.forFeature([
      SaProject, SaProjectVersion, SaProjectMember, SaRecording, SaAnalysisRun,
      SaTranscript, SaTranscriptSegment, SaResult, AiMediaAsset, AiUpload, IntegrationGrant,
      SaMetricDefinition, SaMetricRevision, SaProjectVersionMetric, SaMetricValue,
      SaHumanReview, SaTranscriptCorrection,
      SaReportDefinition, SaReportRun, SaReportSnapshotItem, SaReportSchedule,
      SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem,
      SaTenantCapturePolicy, SaRecordingRelation,
      User, NumberList,
    ]),
  ],
  providers: [SpeechAnalyticsService, SaMetricsService, SaReportingService, SaJournalService, SaProjectResolver],
  controllers: [SpeechAnalyticsJwtController, SpeechAnalyticsPublicController],
  exports: [SpeechAnalyticsService, SaMetricsService, SaReportingService, SaJournalService, SequelizeModule],
})
export class SpeechAnalyticsModule {}
