/**
 * Übersetzungen (Deutsch / Englisch) ohne Bibliothek.
 *
 *  - t('schluessel', { platzhalter: wert })   außerhalb von React (alert, Dateinamen …)
 *  - useT()                                   in Komponenten; rendert bei Sprachwechsel neu
 *  - errorText(e)                             Text zu SerializeError & Co.
 *
 * Die Sprache ist eine Einstellung (auto | de | en, siehe settingsStore);
 * "auto" folgt der Browsersprache: Deutsch → de, alles andere → en.
 * <html lang> wird mitgeführt (Screenreader, Silbentrennung).
 */
import { de, type TKey } from './de';
import { en } from './en';
import { useSettingsStore } from '../store/settingsStore';
import { SerializeError } from '../lib/serializer';

export type { TKey };
export type Lang = 'de' | 'en';
export type LangPref = 'auto' | Lang;

const DICTS: Record<Lang, Record<TKey, string>> = { de, en };

export function resolveLang(pref: LangPref): Lang {
  if (pref !== 'auto') return pref;
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return langs.some(l => l?.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

export type TParams = Record<string, string | number>;
export type TFunc = (key: TKey, params?: TParams) => string;

function translate(lang: Lang, key: TKey, params?: TParams): string {
  let text = DICTS[lang][key] ?? DICTS.de[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** Aktuelle Sprache, außerhalb von React gelesen. */
export function currentLang(): Lang {
  return resolveLang(useSettingsStore.getState().settings.language);
}

export const t: TFunc = (key, params) => translate(currentLang(), key, params);

/** Hook: liefert eine t-Funktion für die aktuelle Sprache und rendert bei Sprachwechsel neu. */
export function useT(): TFunc & { lang: Lang } {
  const lang = useSettingsStore(s => resolveLang(s.settings.language));
  const fn: TFunc = (key, params) => translate(lang, key, params);
  return Object.assign(fn, { lang });
}

/** Anzeigetext zu einem Fehler beim Lesen einer Datei. */
export function errorText(e: unknown): string {
  if (e instanceof SerializeError && e.code === 'version') return t('err.version', { v: e.detail ?? '?' });
  return t('err.unreadable');
}

// <html lang> mitführen
function applyLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = currentLang();
}
applyLang();
useSettingsStore.subscribe((s, prev) => {
  if (s.settings.language !== prev.settings.language) applyLang();
});
