import { Module } from '@nestjs/common';
import { AmiService } from './ami.service';
import { AmiGateway } from './ami.gateway';

@Module({
  providers: [AmiService, AmiGateway],
  exports: [AmiService],
})
export class AmiModule {}
