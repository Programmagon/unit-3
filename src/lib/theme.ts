/**
 * Farbschema: Einstellung (auto | light | dark) → aufgelöstes Theme (light | dark).
 * Das aufgelöste Theme steht IMMER als data-theme am <html>-Element; theme.css
 * und der Canvas (canvas/theme.ts) reagieren nur darauf. Kein React-Import.
 */
export type ThemePref = 'auto' | 'light' | 'dark';
export type ThemeName = 'light' | 'dark';

const KEY = 'u3.theme';
const query = () => window.matchMedia('(prefers-color-scheme: light)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch { return 'auto'; }
}

export function resolveTheme(pref: ThemePref): ThemeName {
  return pref === 'auto' ? (query().matches ? 'light' : 'dark') : pref;
}

/** Setzt data-theme und die Browser-Leistenfarbe (iPad/Handy). */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(pref);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg-ui').trim());
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
  } catch { /* Speicher gesperrt: Einstellung gilt nur für diese Sitzung */ }
  applyTheme(pref);
}

/** Einmal beim Start (vor dem ersten Rendern). Folgt dem System, solange „auto“ gewählt ist. */
export function initTheme(): void {
  applyTheme(getThemePref());
  query().addEventListener('change', () => { if (getThemePref() === 'auto') applyTheme('auto'); });
}
