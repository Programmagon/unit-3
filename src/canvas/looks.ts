/**
 * Looks — komplette, benannte Darstellungs-Stile zur Auswahl im Menü.
 *
 * Ein Look legt Form (Verbindung, Abstand, Rundung, Kontur) UND Aussehen
 * (Symbole, Leuchten, Aus-Farben) fest. Alles, was ein Look nicht nennt,
 * kommt aus CODE_DEFAULTS (cellStyle.ts). Der Look "standard" hat keine
 * eigenen Werte und ist damit genau die Darstellung aus CELL_STYLE — wer
 * dort zum Testen etwas ändert, ändert den Standard-Look.
 *
 * Gedacht für den Beta-Test: Testende wählen einen Look und melden den
 * Buchstaben (A–F) zurück; die Namen und Beschreibungen stehen in i18n/.
 */
import { CODE_DEFAULTS, type CellStyle } from './cellStyle';

export type LookId = 'standard' | 'calm' | 'seam' | 'tiles' | 'sharp' | 'classic';

export interface Look {
  id: LookId;
  /** Kurzbezeichnung für Feedback ("Look C gefällt mir") */
  letter: string;
  patch: Partial<CellStyle>;
}

export const LOOKS: readonly Look[] = [
  { id: 'standard', letter: 'A', patch: {} },
  {
    id: 'calm', letter: 'B',
    patch: {
      connect: 'join', pad: 0, round: 0.15, roundMode: 'outer', seamW: 0.5, edge: 0.5,
      glyph: 'none', glyphSize: 0.5, glow: false, offTone: 'C Smaragd hell',
    },
  },
  {
    id: 'seam', letter: 'C',
    patch: {
      connect: 'seam', pad: 0, round: 0.12, roundMode: 'outer', seamW: 1, edge: 0.5,
      glyph: 'line', glyphSize: 0.55, glow: true, offTone: 'D Jade',
    },
  },
  {
    id: 'tiles', letter: 'D',
    patch: {
      connect: 'off', pad: 0.1, round: 0.22, roundMode: 'cell', seamW: 0.5, edge: 0.5,
      glyph: 'sel', glyphSize: 0.5, glow: true, offTone: 'C Smaragd hell',
    },
  },
  {
    id: 'sharp', letter: 'E',
    patch: {
      connect: 'join', pad: 0, round: 0, roundMode: 'outer', seamW: 0.5, edge: 0,
      glyph: 'line', glyphSize: 0.55, glow: false, offTone: 'E Mix 35%',
    },
  },
  {
    // Die Darstellung vor dem Redesign — als Vergleichsbasis für das Feedback.
    id: 'classic', letter: 'F',
    patch: {
      connect: 'seam', pad: 0.07, round: 0.12, roundMode: 'outer', seamW: 1, edge: 1.5,
      glyph: 'line', glyphSize: 0.55, glow: true, offTone: null,
    },
  },
];

export const LOOK_IDS: readonly LookId[] = LOOKS.map(l => l.id);

export function getLook(id: LookId): Look {
  return LOOKS.find(l => l.id === id) ?? LOOKS[0];
}

/** Vollständiger Stil eines Looks (Code-Werte + Look-Werte). */
export function styleForLook(id: LookId): CellStyle {
  return { ...CODE_DEFAULTS, ...getLook(id).patch };
}
