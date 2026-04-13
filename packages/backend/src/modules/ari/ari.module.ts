import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AriHttpClientService } from './ari-http-client.service';
import { AriConnectionService } from './ari-connection.service';

@Module({
  imports: [ConfigModule],
  providers: [AriHttpClientService, AriConnectionService],
  exports: [AriHttpClientService, AriConnectionService],
})
export class AriModule {}
