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
import { SpeechAnalyticsService } from './speech-analytics.service';
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
    ]),
  ],
  providers: [SpeechAnalyticsService, SaProjectResolver],
  controllers: [SpeechAnalyticsJwtController, SpeechAnalyticsPublicController],
  exports: [SpeechAnalyticsService, SequelizeModule],
})
export class SpeechAnalyticsModule {}
