/**
 * Zell-Optik des Canvas.
 *
 * CELL_STYLE ist 1:1 das Einstellungs-Objekt aus dem Render-Labor
 * („Einstellungen als Text“). Neue Werte aus dem Labor ersetzen hier einfach
 * die Felder; die Labor-Felder zoomBeimTest, farbschema und hintergrund
 * gehören nicht hierher (Zoom macht die Kamera, Farben kommen aus theme.css).
 *
 * Farben stehen in theme.css (--cell-*, --canvas-bg), damit Hell/Dunkel an
 * einer Stelle gepflegt wird. Hier steht nur, wie gezeichnet wird. Das Raster
 * wird wie im Labor aus --canvas-bg abgeleitet (ändert sich der Hintergrund,
 * ziehen Raster, Fugen und gemischte Aus-Töne automatisch mit). Die Palette
 * wird pro Theme einmal aus dem CSS gelesen und gemerkt.
 */
import type { CellType } from '../simulation/types';
import type { ThemeName } from '../lib/theme';

export interface CellStyle {
  /** Farbe eines eingeschalteten Kabels */
  green: string;
  /** Nur Dunkel: 0 = feste Aus-Farben aus theme.css, > 0 = Bauteilfarbe mit Hintergrund gemischt */
  offMix: number;
  /** Nur Dunkel: Aus-Farben aller Typen, Name aus OFF_TONES (null = feste Werte aus theme.css). Hat Vorrang vor offMix. */
  offTone: string | null;
  /** Abstand zwischen Zellen als Anteil der Zellgröße (0 = vollflächig) */
  pad: number;
  /** off = einzelne Zellen, join = verschmolzen, seam = verschmolzen mit Fuge */
  connect: 'off' | 'join' | 'seam';
  /** Fugenbreite in px (nur bei connect = seam) */
  seamW: number;
  /** Eckenradius als Anteil der Zellgröße */
  round: number;
  /** outer = nur freie Außenecken runden, cell = jede Zelle einzeln */
  roundMode: 'outer' | 'cell';
  /** Konturbreite in px (0 = aus) */
  edge: number;
  /** line = alle Symbole, sel = nur Umkehrer/Verzögerer, dot = Punkt, none = keine */
  glyph: 'line' | 'sel' | 'dot' | 'none';
  /** Symbolgröße als Anteil der Zellgröße */
  glyphSize: number;
  /** Leuchten eingeschalteter Zellen (wirkt nur im dunklen Theme) */
  glow: boolean;
  /** Raster zeichnen */
  grid: boolean;
}

export const CELL_STYLE: CellStyle = {
  green: '#23e885',
  offMix: 0,
  offTone: 'C Smaragd hell',
  pad: 0,
  connect: 'join',
  seamW: 0.5,
  round: 0.15,
  roundMode: 'outer',
  edge: 0.5,
  glyph: 'sel',
  glyphSize: 0.5,
  glow: true,
  grid: true,
};

/**
 * Die Werte aus dem Code (oben), unverändert festgehalten. Das Einstellungsmenü
 * (store/settingsStore.ts) überschreibt CELL_STYLE zur Laufzeit und setzt bei
 * „Zurücksetzen“ auf genau diese Werte zurück — wer CELL_STYLE oben zum Testen
 * ändert, ändert damit also den Standard des Menüs.
 */
export const CODE_DEFAULTS: Readonly<CellStyle> = { ...CELL_STYLE };

/** Überschreibt Felder von CELL_STYLE zur Laufzeit und verwirft die gemerkte Palette. */
export function applyCellStyle(patch: Partial<CellStyle>): void {
  Object.assign(CELL_STYLE, patch);
  cached = null;
}

export interface Palette {
  theme: ThemeName;
  bg: string;
  grid: string;
  gridMajor: string;
  /** Deckkraft des Leuchtens; 0 = kein Leuchten (Hell) */
  glow: number;
  glyphOn: string;
  /** Rahmen der Selektion */
  selection: string;
  on: Record<CellType, string>;
  /** Kontur um eingeschaltete Zellen */
  edge: Record<CellType, string>;
  off: Record<CellType, string>;
  /** Kontur um ausgeschaltete Zellen (auch Farbe der Symbole auf Aus-Zellen) */
  offLine: Record<CellType, string>;
}

/** Mischt zwei #rrggbb-Farben (t = 0 → a, t = 1 → b). Bei ungültiger Eingabe kommt a zurück. */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = parse(a), B = parse(b);
  if (A.some(Number.isNaN) || B.some(Number.isNaN)) return a;
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Aus-Töne für das dunkle Theme (alle drei Typen).
 *  - cable/s/l: Kabel fester Wert; Umkehrer und Verzögerer behalten ihre Farbrichtung
 *    und bekommen dieselbe Sättigung s und Helligkeit l (in %).
 *  - mix: Typfarbe mit dem Canvas-Hintergrund gemischt (0–1).
 */
const OFF_TONES: Record<string, { cable: string; s: number; l: number } | { mix: number }> = {
  'C Smaragd hell': { cable: '#128a50', s: 77, l: 31 },
  'D Jade':         { cable: '#14925a', s: 76, l: 33 },
  'E Mix 35%':      { mix: 0.35 },
  'F Mix 45%':      { mix: 0.45 },
};

/** Namen der wählbaren Aus-Töne (für das Einstellungsmenü) */
export const OFF_TONE_NAMES: readonly string[] = Object.keys(OFF_TONES);

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = M === r ? ((g - b) / d + 6) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

function offToneColor(name: string, type: CellType, on: string, bg: string): string | null {
  const t = OFF_TONES[name];
  if (!t) return null;
  if ('mix' in t) return mixHex(bg, on, t.mix);
  if (type === 'cable') return t.cable;
  return hslHex(toHsl(on)[0], t.s, t.l);
}

/** CellType → Namensteil der CSS-Variablen (--cell-<name>-…) */
const CSS_NAME: Record<CellType, string> = { cable: 'cable', inverter: 'inv', delay: 'delay' };
const TYPES: CellType[] = ['cable', 'inverter', 'delay'];

function buildPalette(theme: ThemeName): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const dark = theme === 'dark';
  const bg = v('--canvas-bg');
  const mixOff = dark && CELL_STYLE.offMix > 0;

  const on = {} as Record<CellType, string>;
  const edge = {} as Record<CellType, string>;
  const off = {} as Record<CellType, string>;
  const offLine = {} as Record<CellType, string>;
  for (const t of TYPES) {
    const n = CSS_NAME[t];
    on[t]   = t === 'cable' ? CELL_STYLE.green : v(`--cell-${n}`);
    edge[t] = dark ? on[t] : v(`--cell-${n}-edge`);
    const tone = dark && CELL_STYLE.offTone ? offToneColor(CELL_STYLE.offTone, t, on[t], bg) : null;
    if (tone) {
      off[t]     = tone;
      offLine[t] = mixHex(tone, on[t], 0.3);
    } else if (mixOff) {
      off[t]     = mixHex(bg, on[t], CELL_STYLE.offMix);
      offLine[t] = mixHex(bg, on[t], Math.min(0.7, CELL_STYLE.offMix + 0.3));
    } else {
      off[t]     = v(`--cell-${n}-off`);
      offLine[t] = v(`--cell-${n}-off-line`);
    }
  }

  return {
    theme, bg,
    grid:      mixHex(bg, dark ? '#ffffff' : '#000000', dark ? 0.06 : 0.08),
    gridMajor: mixHex(bg, dark ? '#ffffff' : '#000000', dark ? 0.12 : 0.15),
    glow: dark ? 0.35 : 0,
    glyphOn: 'rgba(13,15,21,.55)',
    selection: dark ? 'rgba(255,255,255,.7)' : 'rgba(21,32,45,.7)',
    on, edge, off, offLine,
  };
}

let cached: Palette | null = null;

/** Aufgelöstes Theme steht immer als data-theme am <html> (siehe lib/theme.ts). */
export function getCellPalette(): Palette {
  const theme: ThemeName = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  if (!cached || cached.theme !== theme) cached = buildPalette(theme);
  return cached;
}
