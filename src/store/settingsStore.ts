/**
 * Einstellungen (Menü, SettingsMenu.tsx).
 *
 * Gespeichert werden nur die Werte, die der Nutzer geändert hat ("overrides").
 * Der Rest ergibt sich aus den Standards. Die Darstellung kommt aus einem
 * Look (canvas/looks.ts); Symbole, Leuchten, Raster und Aus-Farben sind
 * Feinabstimmung auf dem gewählten Look. Ein Look-Wechsel verwirft diese
 * Feinabstimmung, damit der Look so aussieht, wie er beschrieben ist (wichtig
 * für Beta-Feedback: "Look C" ist dann immer dasselbe).
 *
 * Das Farbschema (Auto/Hell/Dunkel) hat einen eigenen Speicher, siehe
 * lib/theme.ts. Projekte stehen in store/projectStore.ts.
 *
 * Diese Datei importiert i18n nicht (i18n liest die Sprache von hier).
 */
import { create } from 'zustand';
import { OFF_TONE_NAMES, applyCellStyle } from '../canvas/cellStyle';
import { LOOK_IDS, styleForLook, type LookId } from '../canvas/looks';
import type { CellStyle } from '../canvas/cellStyle';

export type StraightLine = 'auto' | 'off' | 'shift';
export type TouchTap = 'power' | 'delete';
export type LangPref = 'auto' | 'de' | 'en';
export type KeyHints = 'auto' | 'on' | 'off';
export type PanelId = 'settings' | 'projects';

export interface Settings {
  look: LookId;
  // Feinabstimmung (Standard: Wert des Looks)
  glyph: CellStyle['glyph'];
  glow: boolean;
  grid: boolean;
  /** Aus-Farben im dunklen Schema; null = feste Werte aus theme.css */
  offTone: string | null;
  /** Gerade Linie beim Ziehen: automatisch, nie, oder nur mit gehaltener Umschalttaste */
  straightLine: StraightLine;
  /**
   * Touch/Stift: Was ein Tippen auf eine vorhandene Zelle des gleichen Typs tut.
   * power = Force (⊕) umschalten, langes Drücken löscht. delete = löschen,
   * langes Drücken schaltet Force. Maus ist unabhängig davon.
   */
  touchTap: TouchTap;
  language: LangPref;
  /** Kürzel an den Knöpfen zeigen: automatisch (Maus oder erkannte Hardware-Tastatur), immer, nie */
  keyHints: KeyHints;
  /** Arbeitsstand automatisch im Browser sichern und beim Start wiederherstellen */
  autosave: boolean;
}

export type Overrides = Partial<Settings>;

/** Schlüssel der Feinabstimmung — hängen vom Look ab und werden bei Look-Wechsel verworfen. */
export const TWEAK_KEYS = ['glyph', 'glow', 'grid', 'offTone'] as const satisfies readonly (keyof Settings)[];

// ── Speichern / Laden ────────────────────────────────────────────────
const KEY = 'u3.settings';

function pick<T>(v: unknown, allowed: readonly T[]): T | undefined {
  return allowed.includes(v as T) ? (v as T) : undefined;
}

/** Übernimmt nur bekannte Schlüssel mit gültigem Wert — alte oder kaputte Daten schaden nicht. */
function sanitize(raw: unknown): Overrides {
  const o: Overrides = {};
  if (typeof raw !== 'object' || raw === null) return o;
  const r = raw as Record<string, unknown>;
  const look = pick(r.look, LOOK_IDS);
  if (look !== undefined) o.look = look;
  const glyph = pick(r.glyph, ['none', 'sel', 'line', 'dot'] as const);
  if (glyph !== undefined) o.glyph = glyph;
  if (typeof r.glow === 'boolean') o.glow = r.glow;
  if (typeof r.grid === 'boolean') o.grid = r.grid;
  if (r.offTone === null || (typeof r.offTone === 'string' && OFF_TONE_NAMES.includes(r.offTone))) {
    o.offTone = r.offTone;
  }
  const straight = pick(r.straightLine, ['auto', 'off', 'shift'] as const);
  if (straight !== undefined) o.straightLine = straight;
  const tap = pick(r.touchTap, ['power', 'delete'] as const);
  if (tap !== undefined) o.touchTap = tap;
  const lang = pick(r.language, ['auto', 'de', 'en'] as const);
  if (lang !== undefined) o.language = lang;
  const hints = pick(r.keyHints, ['auto', 'on', 'off'] as const);
  if (hints !== undefined) o.keyHints = hints;
  if (typeof r.autosave === 'boolean') o.autosave = r.autosave;
  return o;
}

function load(): Overrides {
  try {
    const text = localStorage.getItem(KEY);
    return text ? sanitize((JSON.parse(text) as { o?: unknown }).o) : {};
  } catch { return {}; }
}

function save(o: Overrides): void {
  try {
    if (Object.keys(o).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ v: 1, o }));
  } catch { /* Speicher gesperrt: Einstellungen gelten nur für diese Sitzung */ }
}

/** Standardwerte, abhängig vom gewählten Look. */
function defaultsFor(look: LookId): Settings {
  const st = styleForLook(look);
  return {
    look,
    glyph: st.glyph,
    glow: st.glow,
    grid: st.grid,
    offTone: st.offTone,
    straightLine: 'auto',
    touchTap: 'power',
    language: 'auto',
    keyHints: 'auto',
    autosave: true,
  };
}

function compute(o: Overrides): Settings {
  const s = defaultsFor(o.look ?? 'standard');
  for (const k of Object.keys(o) as (keyof Overrides)[]) {
    const v = o[k];
    if (v !== undefined) (s as unknown as Record<string, unknown>)[k] = v;
  }
  return s;
}

/** Entfernt Überschreibungen, die dem Standard entsprechen (hält den Speicher klein und "geändert"-Anzeigen ehrlich). */
function normalize(o: Overrides): Overrides {
  const out: Overrides = { ...o };
  if (out.look === 'standard') delete out.look;
  const def = defaultsFor(out.look ?? 'standard');
  for (const k of Object.keys(out) as (keyof Overrides)[]) {
    if (k !== 'look' && out[k] === def[k]) delete out[k];
  }
  return out;
}

// ── Store ────────────────────────────────────────────────────────────
interface SettingsState {
  overrides: Overrides;
  /** Wirksame Werte (Standards + Überschreibungen) */
  settings: Settings;
  /** Welches Seitenpanel offen ist. Nicht gespeichert. */
  panel: PanelId | null;
  openPanel: (p: PanelId | null) => void;
  setSetting: <K extends keyof Overrides>(key: K, value: Overrides[K]) => void;
  /** Wählt einen Look und verwirft die Feinabstimmung. */
  setLook: (look: LookId) => void;
  /** Ohne Argument: alles; sonst nur diese Schlüssel auf den Standard */
  resetSettings: (keys?: (keyof Overrides)[]) => void;
}

export const useSettingsStore = create<SettingsState>(set => {
  const overrides = normalize(load());
  return {
    overrides,
    settings: compute(overrides),
    panel: null,
    openPanel: p => set({ panel: p }),
    setSetting: (key, value) => set(s => {
      const o = normalize({ ...s.overrides, [key]: value } as Overrides);
      return { overrides: o, settings: compute(o) };
    }),
    setLook: look => set(s => {
      const o: Overrides = { ...s.overrides, look };
      for (const k of TWEAK_KEYS) delete o[k];
      const n = normalize(o);
      return { overrides: n, settings: compute(n) };
    }),
    resetSettings: keys => set(s => {
      const o: Overrides = keys ? { ...s.overrides } : {};
      if (keys) for (const k of keys) delete o[k];
      // Look zurücksetzen verwirft auch die Feinabstimmung
      if (!keys || keys.includes('look')) for (const k of TWEAK_KEYS) delete o[k];
      const n = normalize(o);
      return { overrides: n, settings: compute(n) };
    }),
  };
});

/** Vollständiger Zellstil der aktuellen Einstellungen (Look + Feinabstimmung). */
export function styleFromSettings(s: Settings): CellStyle {
  return { ...styleForLook(s.look), glyph: s.glyph, glow: s.glow, grid: s.grid, offTone: s.offTone };
}

function applyToCanvas(s: Settings): void {
  applyCellStyle(styleFromSettings(s));
}

applyToCanvas(useSettingsStore.getState().settings);
useSettingsStore.subscribe((s, prev) => {
  if (s.overrides === prev.overrides) return;
  applyToCanvas(s.settings);
  save(s.overrides);
});
