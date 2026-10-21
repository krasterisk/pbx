import { Body, Controller, Delete, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayloadUser } from '../auth/auth.service';
import { PhoneSessionService } from './phone-session.service';
import { getWebrtcRuntimeConfig } from '../endpoints/webrtc-runtime-config';

class PhoneOwnerDto {
  @IsUUID('4') owner!: string;
}
class ConnectPhoneDto extends PhoneOwnerDto {
  @IsString() @MaxLength(255) endpoint!: string;
  @IsIn(['sip', 'webrtc']) mode!: 'sip' | 'webrtc';
}
class DialPhoneDto extends PhoneOwnerDto {
  @IsString() @MaxLength(64) number!: string;
}
class PhoneDirectoryDto {
  @IsString() @MaxLength(80) search = '';
}
type PhoneRequest = { user: JwtPayloadUser };

@Controller('phone-session')
@UseGuards(JwtAuthGuard)
export class PhoneSessionController {
  constructor(private readonly phone: PhoneSessionService) {}
  @Get('contacts')
  directory(@Req() req: PhoneRequest, @Query() query: PhoneDirectoryDto) { return this.phone.directory(req.user.vpbx_user_uid, req.user.sub, query.search); }
  @Post('runtime')
  @Header('Cache-Control', 'no-store')
  async runtime(@Req() req: PhoneRequest, @Body() dto: PhoneOwnerDto) {
    const credentials = await this.phone.credentials(req.user.vpbx_user_uid, req.user.sub, dto.owner);
    return { ...getWebrtcRuntimeConfig(), credentials };
  }
  @Get('endpoints')
  list(@Req() req: PhoneRequest) { return this.phone.list(req.user.vpbx_user_uid, req.user.sub); }
  @Post()
  connect(@Req() req: PhoneRequest, @Body() dto: ConnectPhoneDto) {
    return this.phone.acquire(req.user.vpbx_user_uid, req.user.sub, dto.endpoint, dto.mode, dto.owner);
  }
  @Post('heartbeat')
  heartbeat(@Req() req: PhoneRequest, @Body() dto: PhoneOwnerDto) { return this.phone.heartbeat(req.user.vpbx_user_uid, req.user.sub, dto.owner); }
  @Delete()
  release(@Req() req: PhoneRequest, @Body() dto: PhoneOwnerDto) { return this.phone.release(req.user.vpbx_user_uid, req.user.sub, dto.owner); }
  @Post('credentials')
  @Header('Cache-Control', 'no-store')
  credentials(@Req() req: PhoneRequest, @Body() dto: PhoneOwnerDto) { return this.phone.credentials(req.user.vpbx_user_uid, req.user.sub, dto.owner); }
  @Post('dial')
  dial(@Req() req: PhoneRequest, @Body() dto: DialPhoneDto) { return this.phone.dial(req.user.vpbx_user_uid, req.user.sub, dto.owner, dto.number); }
}
