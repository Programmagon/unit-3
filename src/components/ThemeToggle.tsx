import { useState } from 'react';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { IconMonitor, IconSun, IconMoon } from './icons';

const ORDER: ThemePref[] = ['auto', 'light', 'dark'];
const LABEL: Record<ThemePref, string> = { auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' };

/** Ein Knopf, der reihum wechselt: Automatisch → Hell → Dunkel. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === 'auto' ? IconMonitor : pref === 'light' ? IconSun : IconMoon;
  const text = `Farbschema: ${LABEL[pref]} — klicken für ${LABEL[next]}`;
  return (
    <button
      className="btn"
      type="button"
      aria-label={text}
      title={text}
      onClick={() => { setThemePref(next); setPref(next); }}
    >
      <Icon />
    </button>
  );
}
