import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ivr } from './ivr.model';
import { IvrsController } from './ivrs.controller';
import { IvrsService } from './ivrs.service';

@Module({
  imports: [SequelizeModule.forFeature([Ivr])],
  controllers: [IvrsController],
  providers: [IvrsService],
  exports: [IvrsService],
})
export class IvrsModule {}
