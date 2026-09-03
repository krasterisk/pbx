import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CallbackDialplanController } from './callback-dialplan.controller';
import { CallbackRequest } from './callback-request.model';
import { CallbackRequestsService } from './callback-requests.service';

@Module({
  imports: [SequelizeModule.forFeature([CallbackRequest])],
  controllers: [CallbackDialplanController],
  providers: [CallbackRequestsService],
  exports: [CallbackRequestsService],
})
export class CallbackRequestsModule {}
