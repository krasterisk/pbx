import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { ConfbridgeStaticProfileService } from './confbridge-static-profile.service';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceSseController } from './conference-sse.controller';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceRoom } from './models/conference-room.model';

@Module({
  imports: [SequelizeModule.forFeature([ConferenceRoom]), AmiModule],
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
