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
});
