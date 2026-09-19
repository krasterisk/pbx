import { Controller, Get, Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from './standalone-ai-core.module';

/** Static analytics entrypoint. Product analytics runtime is added in AI-04. */
export const ANALYTICS_API_COMPONENTS = Object.freeze([
  'tenant-identity', 'ai-connectivity', 'product-access-core',
  'integration-credentials',
]);

@Controller('health')
class AnalyticsHealthController {
  @Get()
  health() { return { status: 'ok', profile: 'analytics-api', productRuntime: 'not-installed' }; }
}

@Module({
  imports: [StandaloneAiCoreModule.forProfile('analytics-api')],
  controllers: [AnalyticsHealthController],
})
export class AnalyticsAppModule {}
