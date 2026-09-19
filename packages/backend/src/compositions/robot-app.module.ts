import { Controller, Get, Module } from '@nestjs/common';
import { StandaloneAiCoreModule } from './standalone-ai-core.module';
import { RecordingCaptureModule } from '../modules/recording-capture/recording-capture.module';

/** Robot API skeleton; telephony edge and agent runtime arrive in AI-07. */
export const ROBOT_API_COMPONENTS = Object.freeze([
  'tenant-identity', 'ai-connectivity', 'product-access-core',
  'integration-credentials', 'recording-capture',
]);

@Controller('health')
class RobotHealthController {
  @Get()
  health() { return { status: 'ok', profile: 'robot-api', productRuntime: 'not-installed' }; }
}

@Module({
  imports: [
    StandaloneAiCoreModule.forProfile('robot-api'),
    RecordingCaptureModule,
  ],
  controllers: [RobotHealthController],
})
export class RobotAppModule {}
