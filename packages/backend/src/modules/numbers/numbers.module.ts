import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NumberList } from './number-list.model';
import { NumbersService } from './numbers.service';
import { NumbersController } from './numbers.controller';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [SequelizeModule.forFeature([NumberList]), LoggerModule],
  providers: [NumbersService],
  controllers: [NumbersController],
  exports: [NumbersService],
})
export class NumbersModule {}
