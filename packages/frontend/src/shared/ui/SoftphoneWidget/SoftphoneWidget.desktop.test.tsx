import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoftphoneWidget } from './SoftphoneWidget';

vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const phone = { status: 'registered' as const, callInfo: null, isHeld: false, isMuted: false,
  hangup: vi.fn(), hold: vi.fn(), unhold: vi.fn(), mute: vi.fn(), unmute: vi.fn(), sendDtmf: vi.fn(), makeCall: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
});

it('moves and restores the desktop handset without starting a call, keeping panel focus accessible', async () => {
  const view = render(<SoftphoneWidget floating phone={phone} mode="sip" />);
  const launcher = screen.getByTestId('softphone-widget-trigger');
  expect(launcher.querySelector('img')?.getAttribute('src')).toContain('softphone-handset.png');
  const initial = parseFloat(screen.getByTestId('softphone-widget-chrome').style.getPropertyValue('--launcher-x'));
  fireEvent.keyDown(launcher, { key: 'ArrowLeft' });
  expect(screen.getByTestId('softphone-widget-chrome').style.getPropertyValue('--launcher-x')).toBe(`${initial - 16}px`);
  view.unmount();
  render(<SoftphoneWidget floating phone={phone} mode="sip" />);
  expect(screen.getByTestId('softphone-widget-chrome').style.getPropertyValue('--launcher-x')).toBe(`${initial - 16}px`);
  fireEvent.click(screen.getByTestId('softphone-widget-trigger'), { detail: 0 });
  expect(screen.queryByTestId('softphone-widget-trigger')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('softphone-widget-panel')).toHaveFocus());
  fireEvent.keyDown(screen.getByTestId('softphone-widget-panel'), { key: 'Escape' });
  await waitFor(() => expect(screen.getByTestId('softphone-widget-trigger')).toHaveFocus());
  expect(phone.makeCall).not.toHaveBeenCalled();
});

it('keeps the operator launcher docked while using the shared handset asset', () => {
  render(<SoftphoneWidget phone={phone} mode="sip" />);
  expect(screen.getByTestId('softphone-widget-chrome').style.getPropertyValue('--launcher-x')).toBe('');
  expect(screen.getByTestId('softphone-widget-trigger').querySelector('img')?.getAttribute('src')).toContain('softphone-handset.png');
});

it('moves, resizes and restores the window independently of its launcher', () => {
  const view = render(<SoftphoneWidget floating phone={phone} mode="sip" />);
  fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
  const panel = screen.getByTestId('softphone-widget-panel');
  const initialX = parseFloat(panel.style.getPropertyValue('--floating-x'));
  const initialHeight = parseFloat(panel.style.getPropertyValue('--floating-height'));
  fireEvent.keyDown(screen.getByTestId('softphone-window-move'), { key: 'ArrowLeft' });
  expect(panel.style.getPropertyValue('--floating-x')).toBe(`${initialX - 16}px`);
  fireEvent.keyDown(screen.getByTestId('softphone-window-resize'), { key: 'ArrowDown' });
  expect(panel.style.getPropertyValue('--floating-height')).toBe(`${initialHeight + 16}px`);
  fireEvent.keyDown(screen.getByTestId('softphone-window-resize'), { key: 'ArrowRight' });
  expect(panel.style.width).toBe('376px');
  view.unmount();
  render(<SoftphoneWidget floating phone={phone} mode="sip" panelOpen />);
  const restored = screen.getByTestId('softphone-widget-panel');
  expect(restored.style.width).toBe('376px');
  expect(restored.style.getPropertyValue('--floating-x')).toBe(`${initialX - 16}px`);
  expect(restored.style.getPropertyValue('--floating-height')).toBe(`${initialHeight + 16}px`);
});

it('closes an active call window with the corner button without hanging up', async () => {
  render(<SoftphoneWidget floating phone={{ ...phone, status: 'in-call' }} mode="sip" />);
  fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
  fireEvent.click(screen.getByTestId('softphone-window-close'));
  expect(screen.queryByTestId('softphone-widget-panel')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('softphone-widget-trigger')).toHaveFocus());
  expect(phone.hangup).not.toHaveBeenCalled();
});

it('drags the header and clamps the resized window to the viewport', () => {
  render(<SoftphoneWidget floating phone={phone} mode="sip" panelOpen />);
  const panel = screen.getByTestId('softphone-widget-panel');
  const initialX = parseFloat(panel.style.getPropertyValue('--floating-x'));
  const initialY = parseFloat(panel.style.getPropertyValue('--floating-y'));
  const pointer = (target: Element | Window, type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(target, event);
  };
  pointer(screen.getByTestId('softphone-window-move'), 'pointerdown', 100, 100);
  pointer(window, 'pointermove', 36, 132);
  pointer(window, 'pointerup', 36, 132);
  expect(panel.style.getPropertyValue('--floating-x')).toBe(`${initialX - 64}px`);
  expect(panel.style.getPropertyValue('--floating-y')).toBe(`${initialY + 32}px`);
  pointer(screen.getByTestId('softphone-window-resize'), 'pointerdown', 100, 100);
  pointer(window, 'pointermove', 132, 148);
  pointer(window, 'pointerup', 132, 148);
  expect(panel.style.width).toBe('392px');
  expect(panel.style.getPropertyValue('--floating-height')).toBe('688px');
  pointer(screen.getByTestId('softphone-window-move'), 'pointerdown', 100, 100);
  pointer(window, 'pointermove', 100, -2000);
  pointer(window, 'pointerup', 100, -2000);
  expect(panel.style.getPropertyValue('--floating-y')).toBe('16px');
});

it('explains and performs last-character deletion and full number clearing', async () => {
  const user = userEvent.setup();
  render(<SoftphoneWidget phone={phone} mode="sip" panelOpen />);
  const number = screen.getByRole('textbox', { name: 'callcenter.softphone.dialPlaceholder' });
  fireEvent.change(number, { target: { value: '123' } });
  const backspace = screen.getByRole('button', { name: 'callcenter.softphone.backspace' });
  await user.hover(backspace);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('callcenter.softphone.backspaceHint');
  await user.click(backspace);
  expect(number).toHaveValue('12');
  const clear = screen.getByTestId('softphone-clear-dial');
  await user.hover(clear);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('callcenter.softphone.clearDialHint');
  await user.click(clear);
  expect(number).toHaveValue('');
  expect(clear).toBeDisabled();
});
