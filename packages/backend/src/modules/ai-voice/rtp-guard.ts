export class MediaError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type RtpPacket = {
  peer: string;
  port: number;
  ssrc: number;
  sequence: number;
  timestamp: number;
  padding: boolean;
  extension: boolean;
  csrcCount: number;
  payloadType: number;
};

export type RtpBinding = {
  peer: string;
  port: number;
  ssrc: number;
  payloadType: number;
};

export function assertRtpPacket(binding: RtpBinding, packet: RtpPacket): void {
  if (packet.peer !== binding.peer || packet.port !== binding.port) {
    throw new MediaError('rtp_spoof');
  }
  if (packet.ssrc !== binding.ssrc) throw new MediaError('rtp_ssrc');
  if (packet.padding || packet.extension || packet.csrcCount !== 0) {
    throw new MediaError('rtp_malformed');
  }
  if (packet.payloadType !== binding.payloadType) throw new MediaError('rtp_codec');
  if (!Number.isInteger(packet.sequence) || packet.sequence < 0 || packet.sequence > 65535) {
    throw new MediaError('rtp_malformed');
  }
}
