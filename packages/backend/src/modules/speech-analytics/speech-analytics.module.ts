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
import { SpeechAnalyticsService } from './speech-analytics.service';
import { SaMetricsService } from './metrics/metrics.service';
import { SaProjectResolver } from './sa-project.resolver';
import { SpeechAnalyticsJwtController } from './speech-analytics-jwt.controller';
import { SpeechAnalyticsPublicController } from './speech-analytics-public.controller';

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
    ]),
  ],
  providers: [SpeechAnalyticsService, SaMetricsService, SaProjectResolver],
  controllers: [SpeechAnalyticsJwtController, SpeechAnalyticsPublicController],
  exports: [SpeechAnalyticsService, SaMetricsService, SequelizeModule],
})
export class SpeechAnalyticsModule {}
