import { Controller, Get, Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from './standalone-ai-core.module';
import { AiJobsModule } from '../modules/ai-jobs/ai-jobs.module';
import { AiUsageModule } from '../modules/ai-usage/ai-usage.module';
import { MediaAssetsModule } from '../modules/media-assets/media-assets.module';
import { SpeechAnalyticsModule } from '../modules/speech-analytics/speech-analytics.module';
import { IntegrationDeliveryModule } from '../modules/integration-delivery/integration-delivery.module';
import { healthProductRuntime } from '../modules/product-access/product-runtime';

/** Static analytics entrypoint. Technical pilot runtime, not a commercial launch. */
export const ANALYTICS_API_COMPONENTS = Object.freeze([
  'tenant-identity', 'ai-connectivity', 'product-access-core',
  'integration-credentials', 'ai-jobs', 'media-assets', 'ai-usage',
  'speech-analytics', 'integration-delivery',
]);

@Controller('health')
class AnalyticsHealthController {
  @Get()
  health() {
    return healthProductRuntime('analytics-api');
  }
}

@Module({
  imports: [
    StandaloneAiCoreModule.forProfile('analytics-api'),
    AiJobsModule,
    AiUsageModule,
    MediaAssetsModule,
    SpeechAnalyticsModule,
    IntegrationDeliveryModule,
  ],
  controllers: [AnalyticsHealthController],
})
export class AnalyticsAppModule {}
