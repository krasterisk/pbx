/**
 * WebRTC softphone runtime config (D-17).
 *
 * GET /callcenter/webrtc/config — WSS URL + ICE servers (STUN always, TURN optional from env).
 * TURN credentials stay server-side and are returned only per authenticated request;
 * they must never be inlined into the frontend bundle.
 *
 * Env (read at request time):
 * - ASTERISK_WSS_URL — e.g. wss://pbx.example.com:8089/ws.
 *   When unset/empty, `wssUrl` is null — agent UI must treat this as a config failure
 *   (REGISTER cannot proceed). Ops must set this to the live Asterisk PJSIP WebSocket.
 * - WEBRTC_STUN_SERVERS — comma-separated STUN URLs (default stun:stun.l.google.com:19302)
 * - WEBRTC_TURN_URL / WEBRTC_TURN_USERNAME / WEBRTC_TURN_PASSWORD — optional TURN
 *
 * Note: SIP_DOMAIN is used by endpoints credentials (SIP domain for REGISTER auth),
 * not returned by this endpoint. See EndpointsService getCredentials.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export interface WebrtcIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebrtcConfigResponse {
  wssUrl: string | null;
  iceServers: WebrtcIceServer[];
}

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

@UseGuards(JwtAuthGuard)
@Controller('callcenter/webrtc')
export class CallCenterWebrtcController {
  @Get('config')
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
      // Do not log username/credential (Information Disclosure — T-07-14-02)
      iceServers.push({
        urls: turnUrl,
        username: process.env.WEBRTC_TURN_USERNAME,
        credential: process.env.WEBRTC_TURN_PASSWORD,
      });
    }

    return { wssUrl, iceServers };
  }
}
