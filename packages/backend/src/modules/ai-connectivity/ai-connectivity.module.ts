import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CcAiProvider } from './ai-provider.model';
import { AiProvidersService } from './ai-providers.service';

/** Neutral provider store; no robot CRUD, PBX listener or voicemail dependency. */
@Module({
  imports: [SequelizeModule.forFeature([CcAiProvider])],
  providers: [AiProvidersService],
  exports: [AiProvidersService],
})
export class AiConnectivityModule {}
