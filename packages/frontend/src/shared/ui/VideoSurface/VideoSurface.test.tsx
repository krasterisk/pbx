import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoSurface } from './VideoSurface';

describe('VideoSurface (16.3-01)', () => {
  it('forwards a ref to the native video element', () => {
    const ref = createRef<HTMLVideoElement>();
    render(<VideoSurface ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLVideoElement);
  });

  it('sets aria-hidden on the video when there is no stream', () => {
    const ref = createRef<HTMLVideoElement>();
    render(<VideoSurface ref={ref} />);
    expect(ref.current).toHaveAttribute('aria-hidden', 'true');
    expect(ref.current).not.toHaveAttribute('controls');
  });

  it('applies the mirrored module class instead of an inline transform', () => {
    const ref = createRef<HTMLVideoElement>();
    render(<VideoSurface ref={ref} mirrored />);
    expect(ref.current?.className).toMatch(/mirrored/);
    expect(ref.current?.style.transform).toBe('');
  });
});
