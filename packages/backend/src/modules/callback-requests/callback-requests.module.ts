import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { CallCenterModule } from '../callcenter/callcenter.module';
import { CallbackDialplanController } from './callback-dialplan.controller';
import { CallbackRequest } from './callback-request.model';
import { CallbackRequestsService } from './callback-requests.service';
import { CallbackScannerService } from './callback-scanner.service';

@Module({
  imports: [
    SequelizeModule.forFeature([CallbackRequest]),
    AmiModule,
    CallCenterModule,
  ],
  controllers: [CallbackDialplanController],
  providers: [CallbackRequestsService, CallbackScannerService],
  exports: [CallbackRequestsService, CallbackScannerService],
})
export class CallbackRequestsModule {}
