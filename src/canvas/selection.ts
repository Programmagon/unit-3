import type { Grid, CellType } from '../simulation/types';
import { key } from '../simulation/grid';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Selektions-Modell — State Machine statt Set<string>+pendingOffset
 * ═══════════════════════════════════════════════════════════════════
 * Übernommen aus einem separaten Referenzprojekt (siehe dessen README für
 * die ausführliche Begründung der Regeln) — hier auf Unit-3s Datenmodell
 * übertragen: das Referenzprojekt hat ein FESTES, dichtes Pixel-Grid
 * (Pixel[][], jede Zelle existiert), Unit-3 hat eine UNBEGRENZTE, dünn
 * besetzte Ebene (Grid = Map<string,Cell>, die meisten Positionen haben
 * gar keinen Eintrag). Der "Buffer" einer Selektion ist deshalb hier eine
 * SPARSE Liste bereits belegter Zellen relativ zur oberen linken Ecke
 * eines Rects, nicht ein dichtes 2D-Array.
 *
 * Vier Zustände (NonFloatingSelection + der schwebende Sonderfall):
 *   idle     — nichts ausgewählt
 *   marquee  — Rechteck wird gerade aufgezogen (nur Vorschau, noch nichts committed)
 *   selected — ein Rechteck ist ausgewählt, Inhalt liegt UNVERÄNDERT im Grid
 *   floating — Inhalt wurde aus dem Grid herausgehoben (bei "move": Quelle
 *              geleert) und schwebt frei; kann verschoben/rotiert/gespiegelt
 *              werden, OHNE das Grid zu berühren — erst commitFloating()
 *              schreibt das Ergebnis zurück. Escape/cancelFloating() macht
 *              alles exakt rückgängig, ohne einen Undo-Schritt zu erzeugen.
 *
 * Der entscheidende Vorteil ggü. dem alten pendingOffset-Modell: Rotieren/
 * Spiegeln/Verschieben passieren rein im Speicher (am Buffer), nie am
 * Grid — es gibt daher gar keine Kollision mehr, die blockiert oder mit
 * einer Force-Overwrite-Erlaubnis übersteuert werden müsste. Erst beim
 * COMMIT trifft der Buffer auf das Grid, und dort gilt eine einzige,
 * einfache Regel (siehe stampBuffer).
 * ═══════════════════════════════════════════════════════════════════
 */

export interface Point { x: number; y: number; }
export interface Rect  { x: number; y: number; width: number; height: number; }

/** Eine belegte Zelle, relativ zur oberen linken Ecke ihres Rects (dx,dy ≥ 0). */
export interface BufferCell {
  dx: number; dy: number;
  type: CellType; state: boolean; forced: boolean;
}
/** Sparse — enthält NUR tatsächlich belegte Positionen innerhalb eines Rects. */
export type Buffer = BufferCell[];

export type FloatingOrigin =
  /** Durch Anheben einer bestehenden Selektion entstanden — sourceRect/originalBuffer
   *  werden für cancelFloating() gebraucht (exakte Wiederherstellung). */
  | { kind: 'move'; sourceRect: Rect; originalBuffer: Buffer }
  /** Durch Einfügen oder Duplizieren entstanden — das Grid wurde dafür nie
   *  angefasst, ein Abbruch muss also nirgends etwas zurückschreiben. */
  | { kind: 'new' };

export type NonFloatingSelection =
  | { status: 'idle' }
  | { status: 'marquee'; start: Point; current: Point }
  | { status: 'selected'; rect: Rect };

export interface FloatingSelection {
  status: 'floating';
  rect: Rect;
  buffer: Buffer;
  origin: FloatingOrigin;
  /** Zustand, zu dem cancelFloating() zurückkehrt (i. d. R. der Zustand,
   *  aus dem heraus ensureFloating() aufgerufen wurde). */
  returnState: NonFloatingSelection;
}

export type SelectionState = NonFloatingSelection | FloatingSelection;

// ── Geometrie ─────────────────────────────────────────────────────────

export function normalizeMarquee(start: Point, current: Point): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width:  Math.abs(current.x - start.x) + 1,
    height: Math.abs(current.y - start.y) + 1,
  };
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

/**
 * Rundet Halbe IMMER von Null weg (1.5→2 UND -1.5→-2) — anders als
 * Math.round, das Halbe immer Richtung +Infinity rundet (1.5→2, ABER
 * -1.5→-1). Siehe recenterRect für die Begründung, warum das nicht nur
 * Kosmetik ist.
 */
function roundHalfAwayFromZero(n: number): number {
  return n >= 0 ? Math.round(n) : -Math.round(-n);
}

/**
 * Positioniert ein Rect mit neuen Maßen so, dass sein Mittelpunkt
 * bestmöglich mit dem des alten Rects übereinstimmt — nach einer Rotation
 * (Breite/Höhe tauschen) oder Spiegelung (Maße bleiben gleich, Offset=0).
 *
 * WICHTIG (mit Node isoliert verifiziert, siehe Testlauf in der PR-
 * Beschreibung): der Offset wird NUR aus den alten/neuen DIMENSIONEN
 * abgeleitet und zur bestehenden Integer-Position ADDIERT — NICHT durch
 * Neuberechnung eines Fließkomma-Mittelpunkts aus der aktuellen Position
 * und anschließendes Runden des kombinierten Ausdrucks. Die naheliegende
 * "kombinierte" Variante (auch mit symmetrischem Runden!) akkumuliert über
 * mehrere Rotationen hinweg einen Drift, weil das Vorzeichen des
 * GESAMTEN gerundeten Werts von der aktuellen Position abhängt, nicht nur
 * vom Vorzeichen des gebrochenen Anteils — bei wandernder Position kippt
 * die Rundung irgendwann inkonsistent. Der hier gewählte Ansatz (Offset
 * hängt AUSSCHLIESSLICH von den Dimensionen ab, nie von der Position) ist
 * davon unabhängig: derselbe Offset ergibt sich immer, egal wo das Rect
 * gerade steht. Getestet über 16 Rotationen (4 volle Zyklen), mehrere
 * Seitenverhältnisse und negative Startpositionen — kehrt jedes Mal exakt
 * zur Ausgangsposition zurück.
 */
export function recenterRect(oldRect: Rect, newWidth: number, newHeight: number): Rect {
  const offX = roundHalfAwayFromZero((oldRect.width  - newWidth)  / 2);
  const offY = roundHalfAwayFromZero((oldRect.height - newHeight) / 2);
  return { x: oldRect.x + offX, y: oldRect.y + offY, width: newWidth, height: newHeight };
}

/** Zentriert width×height so, dass ihr Mittelpunkt auf `at` liegt (fürs Einfügen). */
export function centeredAnchor(width: number, height: number, at: Point): Point {
  return { x: at.x - Math.floor(width / 2), y: at.y - Math.floor(height / 2) };
}

// ── Buffer-Transformationen (rein lokal — keine Rundung, keine Position) ─
// dx/dy sind immer relativ zur oberen linken Ecke (0,0) — Rotation/Spiegelung
// arbeiten nur mit den ALTEN Maßen, nie mit der absoluten Grid-Position.

/** height = ALTE Höhe (vor dieser Rotation) — bestimmt die neue Breite. */
export function rotateBufferCW(buffer: Buffer, height: number): Buffer {
  return buffer.map(c => ({ ...c, dx: height - 1 - c.dy, dy: c.dx }));
}
/** width = ALTE Breite (vor dieser Rotation) — bestimmt die neue Höhe. */
export function rotateBufferCCW(buffer: Buffer, width: number): Buffer {
  return buffer.map(c => ({ ...c, dx: c.dy, dy: width - 1 - c.dx }));
}
export function flipBufferH(buffer: Buffer, width: number): Buffer {
  return buffer.map(c => ({ ...c, dx: width - 1 - c.dx }));
}
export function flipBufferV(buffer: Buffer, height: number): Buffer {
  return buffer.map(c => ({ ...c, dy: height - 1 - c.dy }));
}

export function cloneBuffer(buffer: Buffer): Buffer {
  return buffer.map(c => ({ ...c }));
}

/**
 * Berechnet die Maße eines Buffers aus seinen dx/dy-Extents — für
 * importierte .u3sel-Dateien, die (anders als die interne Zwischenablage)
 * keine expliziten Maße mitbringen, nur die Zellen selbst.
 */
export function bufferBounds(buffer: Buffer): { width: number; height: number } {
  if (buffer.length === 0) return { width: 0, height: 0 };
  let maxDx = 0, maxDy = 0;
  for (const c of buffer) {
    if (c.dx > maxDx) maxDx = c.dx;
    if (c.dy > maxDy) maxDy = c.dy;
  }
  return { width: maxDx + 1, height: maxDy + 1 };
}

// ── Grid ↔ Buffer ─────────────────────────────────────────────────────

/** Liest ein Rect aus dem Grid, OHNE es zu verändern (für Kopieren/Duplizieren-Quelle). */
export function extractRegion(grid: Grid, rect: Rect): Buffer {
  const buffer: Buffer = [];
  for (let dy = 0; dy < rect.height; dy++) {
    for (let dx = 0; dx < rect.width; dx++) {
      const cell = grid.get(key(rect.x + dx, rect.y + dy));
      if (cell) buffer.push({ dx, dy, type: cell.type, state: cell.state, forced: cell.forced ?? false });
    }
  }
  return buffer;
}

/** Liest ein Rect UND leert es im selben Zug (fürs Anheben/Verschieben). */
export function extractAndClear(grid: Grid, rect: Rect): { buffer: Buffer; grid: Grid } {
  const buffer: Buffer = [];
  const next = new Map(grid);
  for (let dy = 0; dy < rect.height; dy++) {
    for (let dx = 0; dx < rect.width; dx++) {
      const k = key(rect.x + dx, rect.y + dy);
      const cell = grid.get(k);
      if (cell) buffer.push({ dx, dy, type: cell.type, state: cell.state, forced: cell.forced ?? false });
      next.delete(k);
    }
  }
  return { buffer, grid: next };
}

/**
 * Stempelt einen Buffer bei `at` auf eine Kopie von `grid`.
 *
 * ABSICHTLICHE ABWEICHUNG vom Referenzprojekt: dort ist Stempeln ein
 * VOLLER Ersatz, auch durch leere/transparente Buffer-Zellen ("kein
 * stilles Zusammenführen mit bestehendem Inhalt" — deren bewusste
 * Design-Entscheidung für ein dichtes Pixel-Grid, wo "leer" ein
 * eigenständiger, sichtbarer Zustand ist). Für Unit-3 gilt stattdessen
 * OR-Logik: eine leere Stelle im Buffer darf eine bestehende Grid-Zelle
 * NICHT löschen.
 *
 * Die Umsetzung braucht keinen Sonderfall-Code: weil der Buffer SPARSE
 * ist (nur tatsächlich belegte Positionen haben überhaupt einen Eintrag),
 * ergibt sich die Regel automatisch daraus, dass hier nur geschrieben
 * wird, wofür der Buffer tatsächlich einen Eintrag hat. Nicht-leere
 * Buffer-Zellen überschreiben weiterhin bedingungslos, was immer an der
 * Zielposition lag — das ist der ganze Sinn von Verschieben/Einfügen.
 */
export function stampBuffer(grid: Grid, buffer: Buffer, at: Point): Grid {
  const next = new Map(grid);
  for (const c of buffer) {
    next.set(key(at.x + c.dx, at.y + c.dy), { type: c.type, state: c.state, forced: c.forced });
  }
  return next;
}
