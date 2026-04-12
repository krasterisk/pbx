import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { PsAuth } from '../endpoints/ps-auth.model';
import { PsAor } from '../endpoints/ps-aor.model';
import { PsRegistration } from './ps-registration.model';
import { PsEndpointIdIp } from './ps-endpoint-id-ip.model';
import { TrunksService } from './trunks.service';
import { TrunksController } from './trunks.controller';
import { AmiModule } from '../ami/ami.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PsEndpoint, PsAuth, PsAor,
      PsRegistration, PsEndpointIdIp,
    ]),
    AmiModule,
    LoggerModule,
  ],
  providers: [TrunksService],
  controllers: [TrunksController],
  exports: [TrunksService],
})
export class TrunksModule {}
