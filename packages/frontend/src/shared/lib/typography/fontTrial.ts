import { useSyncExternalStore } from 'react';

export const FONT_TRIAL_KEY = 'krasterisk.fontTrial';
export const FONT_TRIALS = {
  inter: "'Inter', system-ui, -apple-system, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  arial: 'Arial, Helvetica, sans-serif',
  aipbx: "'Nunito Sans', system-ui, sans-serif",
  golos: "'Golos Text', system-ui, sans-serif",
  manrope: "'Manrope', system-ui, sans-serif",
  onest: "'Onest', system-ui, sans-serif",
  geologica: "'Geologica', system-ui, sans-serif",
  commissioner: "'Commissioner', system-ui, sans-serif",
  rubik: "'Rubik', system-ui, sans-serif",
  ptsans: "'PT Sans', system-ui, sans-serif",
  fira: "'Fira Sans', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  source: "'Source Sans 3', system-ui, sans-serif",
} as const;
export type FontTrial = keyof typeof FONT_TRIALS;
export const EXTRA_FONT_TRIALS = [
  ['aipbx', 'aiPBX · Nunito Sans + Roboto'],
  ['golos', 'Golos Text'],
  ['manrope', 'Manrope'],
  ['onest', 'Onest'],
  ['geologica', 'Geologica'],
  ['commissioner', 'Commissioner'],
  ['rubik', 'Rubik'],
  ['ptsans', 'PT Sans'],
  ['fira', 'Fira Sans'],
  ['plex', 'IBM Plex Sans'],
  ['source', 'Source Sans 3'],
] as const;
const REMOTE_FAMILIES: Partial<Record<FontTrial, string>> = {
  aipbx: 'Nunito+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;600;700',
  golos: 'Golos+Text',
  manrope: 'Manrope',
  onest: 'Onest',
  geologica: 'Geologica',
  commissioner: 'Commissioner',
  rubik: 'Rubik',
  ptsans: 'PT+Sans:wght@400;700',
  fira: 'Fira+Sans',
  plex: 'IBM+Plex+Sans',
  source: 'Source+Sans+3',
};
function loadFont(font: FontTrial) {
  const family = REMOTE_FAMILIES[font];
  if (!family || document.getElementById('font-trial-' + font)) return;
  const link = document.createElement('link');
  link.id = 'font-trial-' + font;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=' +
    family +
    (family.includes(':') ? '' : ':wght@400;500;600;700') +
    '&display=swap';
  document.head.appendChild(link);
}
function applySelection(font: FontTrial) {
  loadFont(font);
  if (font === 'inter')
    document.documentElement.style.removeProperty('--font-sans');
  else
    document.documentElement.style.setProperty(
      '--font-sans',
      FONT_TRIALS[font],
    );
  if (font === 'aipbx')
    document.documentElement.style.setProperty(
      '--font-heading',
      "'Roboto', system-ui, sans-serif",
    );
  else document.documentElement.style.removeProperty('--font-heading');
}
const EVENT = 'krasterisk:font-trial';

export function readFontTrial(): FontTrial {
  try {
    const value = sessionStorage.getItem(FONT_TRIAL_KEY);
    return value && Object.prototype.hasOwnProperty.call(FONT_TRIALS, value)
      ? (value as FontTrial)
      : 'inter';
  } catch {
    return 'inter';
  }
}
export function applyFontTrial() {
  const font = readFontTrial();
  applySelection(font);
}
export function setFontTrial(font: FontTrial) {
  try {
    if (font === 'inter') sessionStorage.removeItem(FONT_TRIAL_KEY);
    else sessionStorage.setItem(FONT_TRIAL_KEY, font);
  } catch {
    /* Preview still applies when browser storage is unavailable. */
  }
  applySelection(font);
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
export function useFontTrial() {
  return useSyncExternalStore(subscribe, readFontTrial, () => 'inter' as const);
}
