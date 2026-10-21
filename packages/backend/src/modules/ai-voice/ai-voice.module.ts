import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { CcAiAgent } from '../ai-agents/models/ai-agent.model';
import {
  AiCallControlOperation, AiRobotDeployment, AiRobotDraft, AiRobotVersion,
  AiVoiceEvent, AiVoiceSession, AiVoiceTicket, AiVoiceTurn,
} from './ai-voice.models';
import { AiSipConfigRevision, AiSipConnection, AiSipDidBinding, AiVoiceInvocation } from './sip.models';
import { AiVoiceService } from './ai-voice.service';
import { AiSipService } from './sip.service';
import { AiVoiceDeploymentResolver } from './ai-voice.resolver';
import { AiVoiceJwtController } from './ai-voice-jwt.controller';
import { RobotConfigService } from './robot-config.service';
import { RobotConfigController } from './robot-config.controller';
import { CcAiProvider } from '../ai-connectivity/ai-provider.model';
import { AiBusinessConnection } from '../ai-tool-connectivity/tool.models';
import { KbBase } from '../knowledge/knowledge.models';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RobotPlaygroundService } from './robot-playground.service';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AiRobotsAiAdapter } from './ai-robots-ai.adapter';

@Module({
  imports: [
    IntegrationCredentialsModule,
    ProductAccessCoreModule,
    AiConnectivityModule,
    KnowledgeModule,
    AiPlatformModule,
    SequelizeModule.forFeature([
      CcAiAgent, CcAiProvider, AiBusinessConnection, KbBase, AiRobotDraft, AiRobotVersion, AiRobotDeployment,
      AiVoiceSession, AiVoiceTurn, AiVoiceEvent, AiCallControlOperation, AiVoiceTicket,
      AiSipConnection, AiSipConfigRevision, AiSipDidBinding, AiVoiceInvocation,
    ]),
  ],
  providers: [AiVoiceService, AiSipService, AiVoiceDeploymentResolver, RobotConfigService, RobotPlaygroundService, AiRobotsAiAdapter],
  controllers: [AiVoiceJwtController, RobotConfigController],
  exports: [AiVoiceService, AiSipService, RobotConfigService, SequelizeModule],
})
export class AiVoiceModule {}
