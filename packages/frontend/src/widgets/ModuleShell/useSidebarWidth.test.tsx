import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { useSidebarWidth } from './useSidebarWidth';

const widthKey = 'krasterisk.moduleShell.width';
const target = { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() };
function pointer(clientX: number, extra: object = {}) {
  return { button: 0, pointerType: 'mouse', pointerId: 7, clientX, currentTarget: target, preventDefault: vi.fn(), ...extra } as unknown as PointerEvent<HTMLElement>;
}
describe('sidebar resize sessions', () => {
 beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); document.body.style.cursor='pointer'; document.body.style.userSelect='text'; });
 afterEach(() => { vi.restoreAllMocks(); document.body.style.cursor=''; document.body.style.userSelect=''; });
 it('moves with the captured pointer, commits once and restores selection/cursor', () => {
  const {result}=renderHook(()=>useSidebarWidth(false));
  act(()=>result.current.onPointerDown(pointer(240)));
  expect(target.setPointerCapture).toHaveBeenCalledWith(7);
  expect(document.body.style.userSelect).toBe('none');
  act(()=>result.current.onPointerMove(pointer(400,{pointerId:8})));
  expect(result.current.width).toBe(240);
  act(()=>result.current.onPointerMove(pointer(340)));
  expect(result.current.width).toBe(340);
  expect(localStorage.getItem(widthKey)).toBeNull();
  act(()=>result.current.onPointerUp(pointer(340)));
  expect(localStorage.getItem(widthKey)).toBe('340');
  expect(document.body.style.cursor).toBe('pointer');
  expect(document.body.style.userSelect).toBe('text');
 });
 it('cancels back to the earlier preference on blur and lost capture', () => {
  localStorage.setItem(widthKey,'320');const {result}=renderHook(()=>useSidebarWidth(false));
  act(()=>result.current.onPointerDown(pointer(320)));
  act(()=>result.current.onPointerMove(pointer(400)));
  act(()=>window.dispatchEvent(new Event('blur')));
  expect(result.current.width).toBe(320);expect(localStorage.getItem(widthKey)).toBe('320');
  expect(document.body.style.cursor).toBe('pointer');
  act(()=>result.current.onPointerDown(pointer(320)));
  act(()=>result.current.onPointerMove(pointer(400)));
  act(()=>result.current.onLostPointerCapture());
  expect(result.current.width).toBe(320);expect(result.current.resizing).toBe(false);
 });
 it('restores global styles when the sidebar unmounts during a drag', () => {
  const {result,unmount}=renderHook(()=>useSidebarWidth(false));
  act(()=>result.current.onPointerDown(pointer(240)));
  expect(document.body.style.cursor).toBe('col-resize');unmount();
  expect(document.body.style.cursor).toBe('pointer');expect(document.body.style.userSelect).toBe('text');
 });
 it('ignores secondary buttons and touch, and keeps width usable with denied storage', () => {
  const {result}=renderHook(()=>useSidebarWidth(false));
  act(()=>result.current.onPointerDown(pointer(240,{button:2})));
  act(()=>result.current.onPointerDown(pointer(240,{pointerType:'touch'})));
  expect(target.setPointerCapture).not.toHaveBeenCalled();
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('denied');});
  act(()=>result.current.onPointerDown(pointer(240)));act(()=>result.current.onPointerMove(pointer(300)));
  act(()=>result.current.onPointerUp(pointer(300)));
  expect(result.current.width).toBe(300);expect(document.body.style.userSelect).toBe('text');
 });
});
