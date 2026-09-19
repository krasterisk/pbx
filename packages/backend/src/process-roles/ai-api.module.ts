import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { StandaloneAiCoreModule } from '../compositions/standalone-ai-core.module';
import { AiJobsModule } from '../modules/ai-jobs/ai-jobs.module';
import { AiUsageModule } from '../modules/ai-usage/ai-usage.module';
import { MediaAssetsModule } from '../modules/media-assets/media-assets.module';
import { SpeechAnalyticsModule } from '../modules/speech-analytics/speech-analytics.module';
import { IntegrationDeliveryModule } from '../modules/integration-delivery/integration-delivery.module';
import { RecordingCaptureModule } from '../modules/recording-capture/recording-capture.module';
import { AiVoiceModule } from '../modules/ai-voice/ai-voice.module';
import { AiToolConnectivityModule } from '../modules/ai-tool-connectivity/ai-tool-connectivity.module';
import { KnowledgeModule } from '../modules/knowledge/knowledge.module';
import { evaluateAiReadiness } from './ai-readiness';

/** HTTP AI API. Must not import ARI/AMI or billing cron. */
@Controller()
class AiApiHealthController {
  @Get('health/live')
  live() { return { live: true, role: 'ai-api' }; }

  @Get('health/ready')
  ready() {
    const result = evaluateAiReadiness({
      role: 'ai-api',
      schemaReady: process.env.AI_SCHEMA_READY !== '0',
      redisReady: process.env.AI_REDIS_READY !== '0',
      storageReady: process.env.AI_STORAGE_READY !== '0',
      encryptionReady: process.env.AI_ENCRYPTION_READY !== '0',
      providerReady: process.env.AI_PROVIDER_READY !== '0',
      inflight: 0,
      backlog: Number(process.env.AI_BACKLOG || 0),
      backlogCap: Number(process.env.AI_BACKLOG_CAP || 32),
    });
    if (result.status === 503) throw new ServiceUnavailableException(result);
    return result;
  }
}

@Module({
  imports: [
    StandaloneAiCoreModule.forProfile((process.env.DB_SCHEMA_PROFILE as 'analytics-api' | 'robot-api') || 'analytics-api'),
    AiJobsModule,
    AiUsageModule,
    MediaAssetsModule,
    ...((process.env.DB_SCHEMA_PROFILE || 'analytics-api') === 'robot-api'
      ? [RecordingCaptureModule, AiVoiceModule, AiToolConnectivityModule, KnowledgeModule]
      : [SpeechAnalyticsModule, IntegrationDeliveryModule]),
  ],
  controllers: [AiApiHealthController],
})
export class AiApiModule {}
