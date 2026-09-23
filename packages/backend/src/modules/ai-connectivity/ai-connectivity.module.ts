import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CloudSetting } from '../cloud-admin/cloud-setting.model';
import { CcAiProvider } from './ai-provider.model';
import { AiProvidersService } from './ai-providers.service';
import { PlatformSpeechModelsService } from './platform-speech-models.service';

/** Neutral provider store; no robot CRUD, PBX listener or voicemail dependency. */
@Module({
  imports: [SequelizeModule.forFeature([CcAiProvider, CloudSetting])],
  providers: [AiProvidersService, PlatformSpeechModelsService],
  exports: [AiProvidersService, PlatformSpeechModelsService],
})
export class AiConnectivityModule {}
