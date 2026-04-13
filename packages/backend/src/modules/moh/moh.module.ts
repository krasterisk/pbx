import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MohClass } from './moh-class.model';
import { MohEntry } from './moh-entry.model';
import { MohController } from './moh.controller';
import { MohService } from './moh.service';
import { AmiModule } from '../ami/ami.module';

@Module({
  imports: [
    SequelizeModule.forFeature([MohClass, MohEntry]),
    AmiModule,
  ],
  controllers: [MohController],
  providers: [MohService],
  exports: [MohService],
})
export class MohModule {}
