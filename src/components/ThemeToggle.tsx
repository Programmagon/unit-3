import { setThemePref, type ThemePref } from '../lib/theme';
import { useThemePref } from '../lib/useThemePref';
import { IconMonitor, IconSun, IconMoon } from './icons';

const ORDER: ThemePref[] = ['auto', 'light', 'dark'];
const LABEL: Record<ThemePref, string> = { auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' };

/** Ein Knopf, der reihum wechselt: Automatisch → Hell → Dunkel. */
export function ThemeToggle() {
  const pref = useThemePref();
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === 'auto' ? IconMonitor : pref === 'light' ? IconSun : IconMoon;
  const text = `Farbschema: ${LABEL[pref]} — klicken für ${LABEL[next]}`;
  return (
    <button
      className="btn"
      type="button"
      aria-label={text}
      title={text}
      onClick={() => setThemePref(next)}
    >
      <Icon />
    </button>
  );
}
