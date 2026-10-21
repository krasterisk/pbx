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

export type { WebrtcIceServer, WebrtcConfigResponse } from '../endpoints/webrtc-runtime-config';
import { getWebrtcRuntimeConfig } from '../endpoints/webrtc-runtime-config';

@UseGuards(JwtAuthGuard)
@Controller('callcenter/webrtc')
export class CallCenterWebrtcController {
  @Get('config')
  getConfig() { return getWebrtcRuntimeConfig(); }
}
