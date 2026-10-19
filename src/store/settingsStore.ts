/**
 * Einstellungen des Menüs (SettingsMenu.tsx).
 *
 * Gespeichert werden nur die Werte, die der Nutzer geändert hat ("overrides"),
 * nicht der ganze Satz. Der Rest ergibt sich aus den Standards — und die
 * kommen für die Darstellung aus CELL_STYLE in canvas/cellStyle.ts. So bleibt
 * das Testen dort (Werte ändern, neu laden) wirksam, und "Zurücksetzen" geht
 * auf genau diese Code-Werte zurück.
 *
 * Das Farbschema (Auto/Hell/Dunkel) hat einen eigenen Speicher, siehe
 * lib/theme.ts — hier nur der Menü-Zustand und die übrigen Einstellungen.
 */
import { create } from 'zustand';
import {
  CODE_DEFAULTS, OFF_TONE_NAMES, applyCellStyle, type CellStyle,
} from '../canvas/cellStyle';

export type CellShape = 'join' | 'seam' | 'single';
export type StraightLine = 'auto' | 'off' | 'shift';
export type TouchTap = 'power' | 'delete';

export interface Settings {
  /** 'custom' = die Werte aus CELL_STYLE passen zu keiner Auswahl und bleiben unverändert */
  cellShape: CellShape | 'custom';
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
}

/** Vom Nutzer geänderte Werte. Fehlt ein Schlüssel, gilt der Standard. */
export type Overrides = Partial<Omit<Settings, 'cellShape'>> & { cellShape?: CellShape };

/** Die drei wählbaren Zell-Stile (Verbindung, Abstand, Rundung zusammen) */
export const CELL_SHAPES: Record<CellShape, Pick<CellStyle, 'connect' | 'pad' | 'round' | 'roundMode' | 'seamW'>> = {
  join:   { connect: 'join', pad: 0,   round: 0.15, roundMode: 'outer', seamW: 0.5 },
  seam:   { connect: 'seam', pad: 0,   round: 0.12, roundMode: 'outer', seamW: 1 },
  single: { connect: 'off',  pad: 0.1, round: 0.2,  roundMode: 'cell',  seamW: 0.5 },
};

function shapeOf(s: Readonly<CellStyle>): CellShape | 'custom' {
  for (const k of Object.keys(CELL_SHAPES) as CellShape[]) {
    const p = CELL_SHAPES[k];
    if (p.connect === s.connect && p.pad === s.pad && p.round === s.round
      && p.roundMode === s.roundMode && p.seamW === s.seamW) return k;
  }
  return 'custom';
}

export const DEFAULTS: Readonly<Settings> = {
  cellShape:    shapeOf(CODE_DEFAULTS),
  glyph:        CODE_DEFAULTS.glyph,
  glow:         CODE_DEFAULTS.glow,
  grid:         CODE_DEFAULTS.grid,
  offTone:      CODE_DEFAULTS.offTone,
  straightLine: 'auto',
  touchTap:     'power',
};

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
  const shape = pick(r.cellShape, Object.keys(CELL_SHAPES) as CellShape[]);
  if (shape !== undefined) o.cellShape = shape;
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

function compute(o: Overrides): Settings {
  const s: Settings = { ...DEFAULTS };
  for (const k of Object.keys(o) as (keyof Overrides)[]) {
    const v = o[k];
    if (v !== undefined) (s as unknown as Record<string, unknown>)[k] = v;
  }
  return s;
}

// ── Store ────────────────────────────────────────────────────────────
interface SettingsState {
  overrides: Overrides;
  /** Wirksame Werte (Standards + Überschreibungen) */
  settings: Settings;
  /** Menü offen? Nicht gespeichert. */
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  setSetting: <K extends keyof Overrides>(key: K, value: Overrides[K]) => void;
  /** Ohne Argument: alles; sonst nur diese Schlüssel auf den Standard */
  resetSettings: (keys?: (keyof Overrides)[]) => void;
}

export const useSettingsStore = create<SettingsState>(set => {
  const overrides = load();
  return {
    overrides,
    settings: compute(overrides),
    menuOpen: false,
    setMenuOpen: open => set({ menuOpen: open }),
    setSetting: (key, value) => set(s => {
      const o: Overrides = { ...s.overrides, [key]: value } as Overrides;
      if (value === (DEFAULTS as Record<string, unknown>)[key]) delete o[key];
      return { overrides: o, settings: compute(o) };
    }),
    resetSettings: keys => set(s => {
      const o: Overrides = keys ? { ...s.overrides } : {};
      if (keys) for (const k of keys) delete o[k];
      return { overrides: o, settings: compute(o) };
    }),
  };
});

/** Schreibt die Darstellungs-Einstellungen in CELL_STYLE (immer ausgehend von den Code-Werten). */
function applyToCanvas(s: Settings): void {
  applyCellStyle({
    ...CODE_DEFAULTS,
    ...(s.cellShape !== 'custom' ? CELL_SHAPES[s.cellShape] : {}),
    glyph: s.glyph,
    glow: s.glow,
    grid: s.grid,
    offTone: s.offTone,
  });
}

applyToCanvas(useSettingsStore.getState().settings);
useSettingsStore.subscribe((s, prev) => {
  if (s.overrides === prev.overrides) return;
  applyToCanvas(s.settings);
  save(s.overrides);
});
