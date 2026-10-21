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

export function getWebrtcRuntimeConfig(): WebrtcConfigResponse {
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
