import { Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from '../compositions/standalone-ai-core.module';
import { MediaAssetsModule } from '../modules/media-assets/media-assets.module';

/** Media worker: storage and probe only. */
@Module({
  imports: [
    StandaloneAiCoreModule.forProfile((process.env.DB_SCHEMA_PROFILE as 'analytics-api' | 'robot-api') || 'analytics-api'),
    MediaAssetsModule,
  ],
})
export class MediaWorkerModule {}
