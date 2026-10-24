import { setThemePref, type ThemePref } from '../lib/theme';
import { useThemePref } from '../lib/useThemePref';
import { IconMonitor, IconSun, IconMoon } from './icons';
import { useT } from '../i18n';

const ORDER: ThemePref[] = ['auto', 'light', 'dark'];
const LABEL = { auto: 'theme.auto', light: 'theme.light', dark: 'theme.dark' } as const;

/** Ein Knopf, der reihum wechselt: Automatisch → Hell → Dunkel. */
export function ThemeToggle() {
  const t = useT();
  const pref = useThemePref();
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === 'auto' ? IconMonitor : pref === 'light' ? IconSun : IconMoon;
  const text = t('theme.toggle', { current: t(LABEL[pref]), next: t(LABEL[next]) });
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
