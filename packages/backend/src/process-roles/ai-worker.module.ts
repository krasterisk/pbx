import { Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from '../compositions/standalone-ai-core.module';
import { AiJobsModule } from '../modules/ai-jobs/ai-jobs.module';
import { AiUsageModule } from '../modules/ai-usage/ai-usage.module';

/** Background analytics worker. No HTTP management/PBX listeners. */
@Module({
  imports: [
    StandaloneAiCoreModule.forProfile((process.env.DB_SCHEMA_PROFILE as 'analytics-api' | 'robot-api') || 'analytics-api'),
    AiJobsModule,
    AiUsageModule,
  ],
})
export class AiWorkerModule {}
