import React, { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import cls from './VideoSurface.module.scss';

export interface VideoSurfaceProps {
  stream?: MediaStream | null;
  track?: MediaStreamTrack | null;
  mirrored?: boolean;
  muted?: boolean;
  className?: string;
}

const VideoSurface = React.forwardRef<HTMLVideoElement, VideoSurfaceProps>(
  ({ stream, track, mirrored = false, muted = false, className }, ref) => {
    const innerRef = useRef<HTMLVideoElement | null>(null);
    const hasMedia = Boolean(stream || track);

    const setRefs = (node: HTMLVideoElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    useEffect(() => {
      const node = innerRef.current;
      if (!node) return undefined;

      if (!hasMedia) {
        node.srcObject = null;
        return undefined;
      }

      if (stream) {
        node.srcObject = stream;
        return () => {
          node.srcObject = null;
        };
      }

      try {
        const owned = new MediaStream(track ? [track] : []);
        node.srcObject = owned;
        return () => {
          node.srcObject = null;
        };
      } catch {
        node.srcObject = null;
        return undefined;
      }
    }, [stream, track, hasMedia]);

    return (
      <video
        ref={setRefs}
        className={cn(cls.video, mirrored && cls.mirrored, className)}
        autoPlay
        playsInline
        muted={muted}
        aria-hidden={hasMedia ? undefined : true}
      />
    );
  },
);

VideoSurface.displayName = 'VideoSurface';

export { VideoSurface };
