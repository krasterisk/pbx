import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { CcAiAgent } from '../ai-agents/models/ai-agent.model';
import {
  AiCallControlOperation, AiRobotDeployment, AiRobotDraft, AiRobotVersion,
  AiVoiceEvent, AiVoiceSession, AiVoiceTicket, AiVoiceTurn,
} from './ai-voice.models';
import { AiVoiceService } from './ai-voice.service';
import { AiVoiceDeploymentResolver } from './ai-voice.resolver';
import { AiVoiceJwtController } from './ai-voice-jwt.controller';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    SequelizeModule.forFeature([
      CcAiAgent, AiRobotDraft, AiRobotVersion, AiRobotDeployment,
      AiVoiceSession, AiVoiceTurn, AiVoiceEvent, AiCallControlOperation, AiVoiceTicket,
    ]),
  ],
  providers: [AiVoiceService, AiVoiceDeploymentResolver],
  controllers: [AiVoiceJwtController],
  exports: [AiVoiceService, SequelizeModule],
})
export class AiVoiceModule {}
