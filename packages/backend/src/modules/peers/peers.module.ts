import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Peer } from './peer.model';
import { PeersService } from './peers.service';
import { PeersController } from './peers.controller';

@Module({
  imports: [SequelizeModule.forFeature([Peer])],
  providers: [PeersService],
  controllers: [PeersController],
  exports: [PeersService],
})
export class PeersModule {}
