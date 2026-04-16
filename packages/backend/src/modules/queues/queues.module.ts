import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Queue } from './queue.model';
import { QueueMember } from './queue-member.model';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { AmiModule } from '../ami/ami.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Queue, QueueMember]),
    AmiModule,
  ],
  providers: [QueuesService],
  controllers: [QueuesController],
  exports: [QueuesService],
})
export class QueuesModule {}
