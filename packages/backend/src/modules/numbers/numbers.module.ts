import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NumberList } from './number-list.model';
import { NumbersService } from './numbers.service';
import { NumbersController } from './numbers.controller';

@Module({
  imports: [SequelizeModule.forFeature([NumberList])],
  providers: [NumbersService],
  controllers: [NumbersController],
  exports: [NumbersService],
})
export class NumbersModule {}
