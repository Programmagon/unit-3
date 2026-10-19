import { useSyncExternalStore } from 'react';
import { getThemePref, subscribeThemePref, type ThemePref } from './theme';

/** Aktuelle Farbschema-Einstellung (auto | light | dark); aktualisiert sich bei jedem setThemePref. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeThemePref, getThemePref);
}
