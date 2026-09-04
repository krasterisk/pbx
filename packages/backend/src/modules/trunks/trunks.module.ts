import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { PsAuth } from '../endpoints/ps-auth.model';
import { PsAor } from '../endpoints/ps-aor.model';
import { PsRegistration } from './ps-registration.model';
import { PsEndpointIdIp } from './ps-endpoint-id-ip.model';
import { TrunksService } from './trunks.service';
import { TrunksController } from './trunks.controller';
import { TrunksAiAdapter } from './trunks-ai.adapter';
import { AmiModule } from '../ami/ami.module';
import { LoggerModule } from '../logger/logger.module';
import { RoutesModule } from '../routes/routes.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PsEndpoint, PsAuth, PsAor,
      PsRegistration, PsEndpointIdIp,
    ]),
    AmiModule,
    LoggerModule,
    RoutesModule,
    AiPlatformModule,
  ],
  providers: [TrunksService, TrunksAiAdapter],
  controllers: [TrunksController],
  exports: [TrunksService],
})
export class TrunksModule {}
