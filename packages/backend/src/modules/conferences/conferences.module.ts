import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { ConfbridgeStaticProfileService } from './confbridge-static-profile.service';
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
    ]),
    AmiModule,
  ],
  controllers: [ConferenceRoomsController, ConferenceSseController],
  providers: [
    ConferenceRoomsService,
    ConferenceStateService,
    {
      provide: 'ConferenceStateService',
      useExisting: ConferenceStateService,
    },
    ConfbridgeStaticProfileService,
  ],
  exports: [ConferenceRoomsService, ConferenceStateService],
})
export class ConferencesModule {}
