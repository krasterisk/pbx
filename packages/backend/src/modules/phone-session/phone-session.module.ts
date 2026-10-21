import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PhoneSession } from './phone-session.model';
import { PhoneSessionService } from './phone-session.service';
import { PhoneSessionController } from './phone-session.controller';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { User } from '../users/user.model';
import { CcAgentSession } from '../callcenter/models/agent-session.model';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { AmiModule } from '../ami/ami.module';
import { CcContact } from '../callcenter/models/cc-contact.model';

@Module({
  imports: [SequelizeModule.forFeature([PhoneSession, PsEndpoint, User, CcAgentSession, CcContact]), EndpointsModule, AmiModule],
  providers: [PhoneSessionService], controllers: [PhoneSessionController], exports: [PhoneSessionService],
})
export class PhoneSessionModule {}
