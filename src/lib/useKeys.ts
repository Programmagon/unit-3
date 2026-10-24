import { useKeymapStore } from '../store/keymapStore';
import { useT } from '../i18n';
import { formatCombo, type ActionId } from './keymap';

/**
 * Anzeige der aktuellen Belegung in Komponenten (rendert bei Änderungen neu).
 *  - label(action)   "Strg+Z" / "Ctrl+Z" / "⌘Z" — erste Taste der Aktion, '' wenn unbelegt
 *  - badge(action)   kompakt für die kleine Marke am Knopf ("⌃Z"), undefined wenn unbelegt
 *  - titled(text, action)   "Rückgängig [Strg+Z]" für title-Tooltips
 */
export function useKeys() {
  const t = useT();
  const bindings = useKeymapStore(s => s.bindings);
  const first = (a: ActionId) => bindings[a][0];
  const label = (a: ActionId): string => {
    const c = first(a);
    return c ? formatCombo(c, t.lang) : '';
  };
  const badge = (a: ActionId): string | undefined => {
    const c = first(a);
    return c ? formatCombo(c, t.lang, { compact: true }) : undefined;
  };
  const titled = (text: string, a: ActionId | string): string => {
    const k = (a in bindings ? label(a as ActionId) : a);
    return k ? `${text} [${k}]` : text;
  };
  return { label, badge, titled };
}
