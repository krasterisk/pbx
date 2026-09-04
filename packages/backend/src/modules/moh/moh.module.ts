import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MohClass } from './moh-class.model';
import { MohEntry } from './moh-entry.model';
import { MohController } from './moh.controller';
import { MohService } from './moh.service';
import { AmiModule } from '../ami/ami.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { QueuesModule } from '../queues/queues.module';
import { RoutesModule } from '../routes/routes.module';
import { MohAiAdapter } from './moh-ai.adapter';

@Module({
  imports: [
    SequelizeModule.forFeature([MohClass, MohEntry]),
    AmiModule,
    AiPlatformModule,
    QueuesModule,
    RoutesModule,
  ],
  controllers: [MohController],
  providers: [MohService, MohAiAdapter],
  exports: [MohService],
})
export class MohModule {}
