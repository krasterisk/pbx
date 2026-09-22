import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiJobsModule } from '../ai-jobs/ai-jobs.module';
import { MediaAssetsModule } from '../media-assets/media-assets.module';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { RoutesModule } from '../routes/routes.module';
import { AiMediaAsset, AiUpload } from '../media-assets/media-asset.models';
import {
  IntegrationCredential, IntegrationGrant, IntegrationPrincipal,
} from '../integration-credentials/integration-credential.models';
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
import { ProjectEditorService } from './projects/project-editor.service';
import { InsightsService } from './dashboard/insights.service';
import { DashboardService } from './dashboard/dashboard.service';
import { SpeechAnalyticsJwtController } from './speech-analytics-jwt.controller';
import { SpeechAnalyticsPublicController } from './speech-analytics-public.controller';
import { User } from '../users/user.model';
import { NumberList } from '../numbers/number-list.model';
import { Route } from '../routes/route.model';
import { NotificationIntegration } from '../notifications/notification-integration.model';
import { SaInsightsRequest } from './speech-analytics.models';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    AiJobsModule,
    MediaAssetsModule,
    forwardRef(() => RoutesModule),
    SequelizeModule.forFeature([
      SaProject, SaProjectVersion, SaProjectMember, SaRecording, SaAnalysisRun,
      SaTranscript, SaTranscriptSegment, SaResult, AiMediaAsset, AiUpload,
      IntegrationGrant, IntegrationCredential, IntegrationPrincipal,
      SaMetricDefinition, SaMetricRevision, SaProjectVersionMetric, SaMetricValue,
      SaHumanReview, SaTranscriptCorrection,
      SaReportDefinition, SaReportRun, SaReportSnapshotItem, SaReportSchedule,
      SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem,
      SaTenantCapturePolicy, SaRecordingRelation, SaInsightsRequest,
      User, NumberList, Route, NotificationIntegration,
    ]),
  ],
  providers: [
    SpeechAnalyticsService,
    SaMetricsService,
    SaReportingService,
    SaJournalService,
    SaProjectResolver,
    ProjectEditorService,
    InsightsService,
    DashboardService,
  ],
  controllers: [SpeechAnalyticsJwtController, SpeechAnalyticsPublicController],
  exports: [
    SpeechAnalyticsService,
    SaMetricsService,
    SaReportingService,
    SaJournalService,
    ProjectEditorService,
    InsightsService,
    DashboardService,
    SequelizeModule,
  ],
})
export class SpeechAnalyticsModule {}
