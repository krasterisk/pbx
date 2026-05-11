import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterService } from './callcenter.service';
import { CallCenterController } from './callcenter.controller';
import { CallCenterSseController } from './callcenter-sse.controller';
import { CcPauseReason } from './models/pause-reason.model';
import { CcAgentSession } from './models/agent-session.model';
import { CcAgentEvent } from './models/agent-event.model';
import { CcAgentQueue } from './models/agent-queue.model';
import { CcMissedCall } from './models/missed-call.model';
import { Queue } from '../queues/queue.model';
import { User } from '../users/user.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { ServiceRequest } from '../service-requests/service-request.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      CcPauseReason,
      CcAgentSession,
      CcAgentEvent,
      CcAgentQueue,
      CcMissedCall,
      Queue,           // for tenant resolution from queue names
      User,            // for agent display names
      PhonebookEntry,  // Client Card sidebar lookup
      RoutePhonebook,  // Client Card sidebar lookup
      ServiceRequest,  // Client Card sidebar — linked service requests
    ]),
    AmiModule,
  ],
  providers: [
    CallCenterStateService,
    CallCenterAmiService,
    CallCenterService,
  ],
  controllers: [
    CallCenterController,
    CallCenterSseController,
  ],
  exports: [
    CallCenterStateService,
    CallCenterAmiService, // exported so AmiService can resolve it via ModuleRef
    CallCenterService,
  ],
})
export class CallCenterModule {}
