import { Module } from '@nestjs/common';
import { AmiService } from './ami.service';
import { AmiGateway } from './ami.gateway';
import { DialplanApplyService } from './dialplan-apply.service';

@Module({
  imports: [],
  providers: [AmiService, AmiGateway, DialplanApplyService],
  exports: [AmiService, DialplanApplyService],
})
export class AmiModule {}

