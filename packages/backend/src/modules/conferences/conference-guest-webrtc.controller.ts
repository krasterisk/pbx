import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  type WebrtcConfigResponse,
  type WebrtcIceServer,
} from '../callcenter/callcenter-webrtc.controller';
import { ConferenceGuestTokenGuard } from './conference-guest-token.guard';

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

/**
 * Guest ICE/WSS config — same payload as GET /callcenter/webrtc/config,
 * gated by the opaque guest token instead of JWT (D-23/D-24, T-16.1-10).
 * SIP password is never returned here.
 */
@Controller('conferences/guest')
export class ConferenceGuestWebrtcController {
  @UseGuards(ConferenceGuestTokenGuard)
  @Get(':token/webrtc-config')
  getConfig(): WebrtcConfigResponse {
    const wssUrl = process.env.ASTERISK_WSS_URL?.trim() || null;

    const stunRaw = process.env.WEBRTC_STUN_SERVERS?.trim() || DEFAULT_STUN;
    const stunUrls = stunRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const iceServers: WebrtcIceServer[] = [
      { urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls },
    ];

    const turnUrl = process.env.WEBRTC_TURN_URL?.trim();
    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: process.env.WEBRTC_TURN_USERNAME,
        credential: process.env.WEBRTC_TURN_PASSWORD,
      });
    }

    return { wssUrl, iceServers };
  }
}
