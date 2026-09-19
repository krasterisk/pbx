import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiIdempotency, AiJob, AiJobEvent, AiJobStage, AiOutbox, AiProviderOperation,
} from './ai-job.models';
import { AiJobAdmissionService } from './ai-job-admission.service';
import { AiOutboxDispatcherService } from './ai-outbox-dispatcher.service';
import { AiStageLeaseService } from './ai-stage-lease.service';

/** Durable job/outbox runtime. HTTP analysis remains AI-04. Not imported by AppModule. */
@Module({
  imports: [SequelizeModule.forFeature([
    AiIdempotency, AiJob, AiJobStage, AiProviderOperation, AiOutbox, AiJobEvent,
  ])],
  providers: [AiJobAdmissionService, AiStageLeaseService, AiOutboxDispatcherService],
  exports: [
    SequelizeModule, AiJobAdmissionService, AiStageLeaseService, AiOutboxDispatcherService,
  ],
})
export class AiJobsModule {}
