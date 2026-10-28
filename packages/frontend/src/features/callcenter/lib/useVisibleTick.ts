import { useEffect, useRef, useState } from 'react';
import { useNowTick } from './useNowTick';

const targets = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;

function observe(target: Element, callback: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    callback(true);
    return () => {};
  }
  if (!observer) observer = new IntersectionObserver(entries => {
    entries.forEach(entry => targets.get(entry.target)?.(entry.isIntersecting));
  }, { rootMargin: '80px 0px' });
  targets.set(target, callback);
  observer.observe(target);
  return () => {
    observer?.unobserve(target);
    targets.delete(target);
    if (!targets.size) { observer?.disconnect(); observer = null; }
  };
}

/** Keep elapsed cells current on screen without ticking hundreds of offscreen rows. */
export function useVisibleTick(enabled: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (!enabled || !ref.current) { setVisible(false); return undefined; }
    return observe(ref.current, setVisible);
  }, [enabled]);
  return { ref, now: useNowTick(enabled && visible) };
}
