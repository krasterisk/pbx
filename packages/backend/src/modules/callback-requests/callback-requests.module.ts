import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { CallCenterModule } from '../callcenter/callcenter.module';
import { CcAgentQueue } from '../callcenter/models/agent-queue.model';
import { Route } from '../routes/route.model';
import { User } from '../users/user.model';
import { CallbackDialplanController } from './callback-dialplan.controller';
import { CallbackRequest } from './callback-request.model';
import { CallbackRequestsController } from './callback-requests.controller';
import { CallbackRequestsService } from './callback-requests.service';
import { CallbackScannerService } from './callback-scanner.service';

@Module({
  imports: [
    SequelizeModule.forFeature([CallbackRequest, CcAgentQueue, User, Route]),
    AmiModule,
    CallCenterModule,
  ],
  controllers: [CallbackDialplanController, CallbackRequestsController],
  providers: [CallbackRequestsService, CallbackScannerService],
  exports: [CallbackRequestsService, CallbackScannerService],
})
export class CallbackRequestsModule {}
