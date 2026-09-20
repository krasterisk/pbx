import { Controller, Get, Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from './standalone-ai-core.module';
import { RecordingCaptureModule } from '../modules/recording-capture/recording-capture.module';
import { AiVoiceModule } from '../modules/ai-voice/ai-voice.module';
import { AiToolConnectivityModule } from '../modules/ai-tool-connectivity/ai-tool-connectivity.module';
import { KnowledgeModule } from '../modules/knowledge/knowledge.module';

/** Robot API skeleton; telephony edge and agent runtime arrive in AI-07. */
export const ROBOT_API_COMPONENTS = Object.freeze([
  'tenant-identity', 'ai-connectivity', 'product-access-core',
  'integration-credentials', 'recording-capture', 'ai-voice', 'ai-tool-connectivity', 'knowledge',
]);

@Controller('health')
class RobotHealthController {
  @Get()
  health() {
    return { status: 'ok', profile: 'robot-api', productRuntime: 'not-installed', usable: false };
  }
}

@Module({
  imports: [
    StandaloneAiCoreModule.forProfile('robot-api'),
    RecordingCaptureModule,
    AiVoiceModule,
    AiToolConnectivityModule,
    KnowledgeModule,
  ],
  controllers: [RobotHealthController],
})
export class RobotAppModule {}
