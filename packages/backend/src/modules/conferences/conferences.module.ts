import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { LoggerModule } from '../logger/logger.module';
import { User } from '../users/user.model';
import { ConfbridgeStaticProfileService } from './confbridge-static-profile.service';
import { ConferenceEphemeralService } from './conference-ephemeral.service';
import { ConferenceModerationController } from './conference-moderation.controller';
import { ConferenceModerationService } from './conference-moderation.service';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceSseController } from './conference-sse.controller';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceGuestToken } from './models/conference-guest-token.model';
import { ConferenceMeetingParticipant } from './models/conference-meeting-participant.model';
import { ConferenceMeeting } from './models/conference-meeting.model';
import { ConferenceRoomModerator } from './models/conference-room-moderator.model';
import { ConferenceRoom } from './models/conference-room.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ConferenceRoom,
      ConferenceRoomModerator,
      ConferenceGuestToken,
      ConferenceMeeting,
      ConferenceMeetingParticipant,
      User,
    ]),
    AmiModule,
    LoggerModule,
  ],
  controllers: [
    ConferenceRoomsController,
    ConferenceModerationController,
    ConferenceSseController,
  ],
  providers: [
    ConferenceRoomsService,
    ConferenceModerationService,
    ConferenceStateService,
    {
      provide: 'ConferenceStateService',
      useExisting: ConferenceStateService,
    },
    ConferenceEphemeralService,
    {
      provide: 'ConferenceEphemeralService',
      useExisting: ConferenceEphemeralService,
    },
    ConfbridgeStaticProfileService,
  ],
  exports: [ConferenceRoomsService, ConferenceStateService, ConferenceEphemeralService],
})
export class ConferencesModule {}
