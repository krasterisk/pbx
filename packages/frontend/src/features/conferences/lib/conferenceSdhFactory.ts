import { Web } from 'sip.js';

type RemoteStreamHost = {
  _remoteMediaStream: MediaStream;
  setRemoteTrack: (track: MediaStreamTrack) => void;
};

/**
 * Conference SDH factory: wrap stock sip.js and replace setRemoteTrack with
 * add-only so a second remote video track does not stop() the first (R-SDH).
 */
export function conferenceSdhFactory(
  mediaStreamFactory?: Web.MediaStreamFactory,
): ReturnType<typeof Web.defaultSessionDescriptionHandlerFactory> {
  const inner = Web.defaultSessionDescriptionHandlerFactory(mediaStreamFactory);
  return (session, options) => {
    const sdh = inner(session, options) as RemoteStreamHost;
    sdh.setRemoteTrack = function setRemoteTrack(this: RemoteStreamHost, track: MediaStreamTrack) {
      if (!this._remoteMediaStream.getTrackById(track.id)) {
        this._remoteMediaStream.addTrack(track);
      }
    };
    return sdh as ReturnType<typeof inner>;
  };
}
