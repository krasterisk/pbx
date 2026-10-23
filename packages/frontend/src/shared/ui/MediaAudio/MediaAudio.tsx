import { forwardRef, type AudioHTMLAttributes } from 'react';
/** Native media controls retain keyboard playback, seeking and browser accessibility. */
export const MediaAudio = forwardRef<HTMLAudioElement, AudioHTMLAttributes<HTMLAudioElement>>((props, ref) => <audio ref={ref} {...props}/>);
MediaAudio.displayName = 'MediaAudio';
