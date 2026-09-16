import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const here = dirname(fileURLToPath(import.meta.url));

const { i18nState } = vi.hoisted(() => ({
  i18nState: {
    language: 'ru',
    changeLanguage: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
    i18n: i18nState,
  }),
}));

import { ConferenceGuestShell } from './ConferenceGuestShell';

function assertNoPbxChrome() {
  expect(screen.queryByTestId('module-shell')).not.toBeInTheDocument();
  expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  expect(screen.queryByTestId('ai-agent-panel')).not.toBeInTheDocument();
  expect(screen.queryByTestId('softphone-widget-chrome')).not.toBeInTheDocument();
  expect(screen.queryByTestId('softphone-widget-trigger')).not.toBeInTheDocument();
  expect(document.getElementById('shell-cmdk-trigger')).toBeNull();
  expect(document.getElementById('shell-agent-trigger')).toBeNull();
  expect(screen.queryByRole('link', { name: /modules/i })).not.toBeInTheDocument();
  expect(document.querySelector('a[href="/modules"]')).toBeNull();
}

describe('ConferenceGuestShell (16.3-07 D-28)', () => {
  it('registers /conf/:token as a top-level sibling of wallboard, outside AppLayout', () => {
    const routerSource = readFileSync(
      resolve(here, '../../app/router/router.tsx'),
      'utf8',
    );
    expect(routerSource).toMatch(/path:\s*['"]\/conf\/:token['"]/);
    expect(routerSource).toMatch(/element:\s*<ConferenceGuestPage/);

    const appStart = routerSource.indexOf("path: '/'");
    const standaloneStart = routerSource.indexOf("path: '/standalone'");
    const appLayoutBlock = routerSource.slice(appStart, standaloneStart);
    expect(appLayoutBlock).not.toMatch(/conf\/:token/);

    const wallboardIdx = routerSource.indexOf('/callcenter/wallboard');
    const guestIdx = routerSource.indexOf('/conf/:token');
    const appLayoutIdx = routerSource.indexOf('element: <AppLayout');
    expect(wallboardIdx).toBeGreaterThan(-1);
    expect(guestIdx).toBeGreaterThan(-1);
    expect(guestIdx).toBeLessThan(appLayoutIdx);
  });

  it('renders a 56px header with logo slot, room name and ru/en language toggle', async () => {
    const user = userEvent.setup();
    i18nState.language = 'ru';
    i18nState.changeLanguage.mockClear();

    render(<ConferenceGuestShell roomName="Standup" />);

    expect(screen.getByTestId('conference-guest-shell')).toBeInTheDocument();
    expect(screen.getByTestId('conference-guest-header')).toBeInTheDocument();
    expect(screen.getByTestId('guest-tenant-logo')).toBeInTheDocument();
    expect(screen.getByText('Standup')).toBeInTheDocument();

    const lang = screen.getByRole('button', { name: 'RU' });
    await user.click(lang);
    expect(i18nState.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('does not leak PBX chrome (ModuleShell / cmdk / agent / softphone / /modules)', () => {
    render(<ConferenceGuestShell roomName="Standup" />);
    assertNoPbxChrome();
  });

  it('uses token background and a 56px header without wallboard TV chrome', () => {
    const scss = readFileSync(resolve(here, './ConferenceGuestShell.module.scss'), 'utf8');
    expect(scss).toMatch(/height:\s*56px/);
    expect(scss).toMatch(/var\(--color-background\)/);
    expect(scss).not.toMatch(/#0b1220/i);
    expect(scss).not.toMatch(/position:\s*fixed/);
    expect(scss).not.toMatch(/inset:\s*0/);
    expect(scss).not.toMatch(/clamp\s*\(/);
  });
});
