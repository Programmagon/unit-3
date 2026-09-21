import { create } from 'zustand';
import type { Grid, CellType, Cell } from '../simulation/types';
import { key, toggleCellState } from '../simulation/grid';
import { simulationStep, SimLoopError } from '../simulation/engine';
import { translateKeys, rotateKeys, mirrorKeys } from '../canvas/selection';
// Typ-only Import aus selectionStore — wird zur Compile-Zeit komplett entfernt
// (verbatimModuleSyntax), also KEIN Laufzeit-Zyklus gridStore↔selectionStore.
// ClipboardCell gehört konzeptionell zu selectionStore (verwaltet die
// Zwischenablage); gridStore braucht den Typ nur für die pasteCells-Signatur.
import type { ClipboardCell } from './selectionStore';
// Laufzeit-Import: undo/redo/clear/load müssen die Selektion aufheben, wenn
// sich der Grid-Zustand unter ihr wegändert (siehe dort). Selection-Drag
// (beginSelectionDrag/dragSelectionTo/...) hält Grid und Selektion synchron.
// Kein struktureller Zyklus: selectionStore.ts importiert nichts aus
// gridStore.ts, die Abhängigkeit bleibt einseitig (gridStore → selectionStore).
import { useSelectionStore } from './selectionStore';

/** Maximale Größe von Undo-/Redo-Stack — älteste Einträge fallen heraus. */
const MAX_UNDO = 60;

/**
 * Rein intern, bewusst außerhalb des Stores (kein Re-Render nötig wenn sich
 * das ändert). true während eines Bresenham-Drags beim Platzieren/Löschen
 * (siehe Canvas.tsx onDragStart/onDragEnd) — verhindert, dass jede einzelne
 * Zelle einer Drag-Linie ihren eigenen Undo-Schritt pusht statt einen
 * gemeinsamen für den ganzen Drag. Der Selektions-Drag (weiter unten) nutzt
 * dieses Flag NICHT — er verwaltet sein eigenes Bündeln über dragSnapshot,
 * weil er zusätzlich revertierbar sein muss (Escape/Pinch-Abbruch).
 */
let batchActive = false;

/**
 * Verschiebt Zellen von oldKeys[i] nach newKeys[i]. Set-Iterationsreihenfolge
 * = Einfügereihenfolge (ES2015+-Garantie), daher ist die Paarung über
 * parallele Arrays stabil — solange oldKeys/newKeys aus derselben
 * Quell-Iteration stammen (translateKeys/rotateKeys/mirrorKeys iterieren ihr
 * Input-Set unverändert durch, siehe canvas/selection.ts).
 * Erst ALLE Quellen löschen, DANN ALLE Ziele setzen — verhindert Kollisionen
 * bei überlappenden alten/neuen Positionen (z. B. Verschieben um 1 Zelle).
 *
 * Reiner Datentransport, KEINE Kollisionsprüfung — die liegt bei den
 * Aufrufern (dragSelectionTo/rotateCells/mirrorCells/pasteCells), die alle
 * derselben Regel folgen: niemals fremde (nicht zur eigenen Operation
 * gehörende) Zellen stillschweigend überschreiben. Siehe Doku dort.
 */
function remapCells(grid: Grid, oldKeys: Set<string>, newKeys: Set<string>): Grid {
  const g = new Map(grid);
  const oldArr = [...oldKeys];
  const newArr = [...newKeys];
  const pairs: [string, Cell][] = [];
  for (let i = 0; i < oldArr.length; i++) {
    const cell = g.get(oldArr[i]);
    if (cell) pairs.push([newArr[i], cell]);
  }
  for (const k of oldArr) g.delete(k);
  for (const [k, cell] of pairs) g.set(k, cell);
  return g;
}

/**
 * Prüft, ob irgendeine der `targetKeys` bereits im Grid belegt ist, OHNE
 * selbst Teil von `ownKeys` (der eigenen, sich gerade bewegenden Auswahl)
 * zu sein — würde die Operation also fremden Inhalt überschreiben?
 * Zentrale Kollisionsregel für Verschieben/Rotieren/Spiegeln/Einfügen.
 */
function collidesWithForeign(grid: Grid, targetKeys: Iterable<string>, ownKeys: Set<string>): boolean {
  for (const k of targetKeys) {
    if (grid.has(k) && !ownKeys.has(k)) return true;
  }
  return false;
}

/**
 * Zustand eines laufenden Selektions-Drags (Maus-Ziehen ODER Pfeiltasten-
 * Nudge — beide nutzen dieselben vier Aktionen unten). Modul-intern wie
 * `batchActive`, kein Re-Render nötig. `moved` hält fest, ob der Drag
 * TATSÄCHLICH irgendwo hin bewegt hat — ein reiner Tap/Klick ohne Bewegung
 * soll keinen leeren Undo-Schritt hinterlassen.
 */
let dragSnapshot: { grid: Grid; keys: Set<string>; moved: boolean } | null = null;

interface GridStore {
  grid:      Grid;
  stepCount: number;
  isRunning: boolean;
  hz:        number;
  loopError: string | null;

  undoStack: Grid[];
  redoStack: Grid[];

  setCell:       (x: number, y: number, type: CellType, state?: boolean) => void;
  deleteCell:    (x: number, y: number) => void;
  toggleState:   (x: number, y: number) => void;
  /**
   * Forced-Flag umschalten.
   * forced=true  → Zelle wird auf ON erzwungen, bleibt dauerhafter Treiber.
   * forced=false → Zelle verhält sich wieder normal (Passive Rule greift).
   */
  toggleForced:  (x: number, y: number) => void;
  step:          () => void;
  setRunning:    (v: boolean) => void;
  setHz:         (v: number) => void;
  clear:         () => void;
  loadGrid:      (g: Grid) => void;

  /** Löscht alle Zellen mit den gegebenen Keys. */
  deleteCells: (keys: Set<string>) => void;
  /**
   * Fügt Zwischenablage-Zellen ein, verankert bei (atX, atY).
   * `null` bei Kollision mit bestehenden Zellen — No-Op, kein Undo-Schritt.
   */
  pasteCells:  (cells: ClipboardCell[], atX: number, atY: number) => Set<string> | null;
  /** Rotiert die Zellen mit den gegebenen Keys um ihr gemeinsames Zentrum. `null` bei Kollision. */
  rotateCells: (keys: Set<string>, dir: 1 | -1) => Set<string> | null;
  /** Spiegelt die Zellen mit den gegebenen Keys. `null` bei Kollision. */
  mirrorCells: (keys: Set<string>, axis: 'x' | 'y') => Set<string> | null;

  /**
   * Startet eine LIVE-Selektionsverschiebung (Maus-Drag oder Pfeiltasten-
   * Nudge) — merkt sich Grid- und Selektions-Ausgangszustand. Schreibt noch
   * nichts. Aufrufer: canvas/input.ts (Drag-Start) bzw.
   * useKeyboardShortcuts.ts (erster Pfeiltasten-Druck einer Nudge-Serie).
   */
  beginSelectionDrag: (keys: Set<string>) => void;
  /**
   * Bewegt die bei beginSelectionDrag() gemerkten Keys zu (dx, dy) RELATIV
   * ZUM AUSGANGSZUSTAND (nicht kumulativ vom letzten Schritt aus — das
   * vermeidet Drift über viele kleine Schritte). Schreibt SOFORT ins Grid
   * UND spiegelt die neue Position direkt in useSelectionStore — beide
   * bleiben dadurch immer synchron, kein separater "pending"-Zustand.
   * Kollision mit fremden Zellen wird verweigert: Grid/Selektion bleiben an
   * der letzten gültigen Position stehen (Rückgabe false) — die Selektion
   * "läuft gegen eine Wand", statt fremden Inhalt zu zerstören.
   */
  dragSelectionTo: (dx: number, dy: number) => boolean;
  /**
   * Schließt den Drag ab: EIN Undo-Schritt für die gesamte Geste (beliebig
   * viele dragSelectionTo-Aufrufe), aber nur wenn tatsächlich etwas bewegt
   * wurde — ein reiner Tap ohne Bewegung hinterlässt keinen Undo-Schritt.
   */
  endSelectionDrag: () => void;
  /**
   * Bricht den Drag ab: stellt exakt den Grid-/Selektionszustand von VOR
   * dem Drag wieder her (Escape, oder ein zweiter Finger übernimmt Pinch).
   * Rührt Undo-/Redo-Stack nicht an — der Drag ist, als hätte er nie
   * stattgefunden.
   */
  cancelSelectionDrag: () => void;

  /** Speichert den aktuellen Grid-Zustand auf dem Undo-Stack (max. 60). */
  pushUndo:   () => void;
  /** Startet einen Batch (Drag) — Mutationen darin pushen keinen eigenen Undo-Schritt. */
  beginBatch: () => void;
  /** Beendet den Batch — einzelne Mutationen pushen wieder normal. */
  endBatch:   () => void;
  /** Letzten Zustand wiederherstellen, aktueller wandert auf den redoStack. */
  undo: () => void;
  /** Zurückgeholten Zustand wiederherstellen. */
  redo: () => void;
}

export const useGridStore = create<GridStore>((set, get) => ({
  grid:      new Map(),
  stepCount: 0,
  isRunning: false,
  hz:        5,
  loopError: null,
  undoStack: [],
  redoStack: [],

  setCell: (x, y, type, state = false) => {
    if (!batchActive) get().pushUndo();
    set(s => {
      const g = new Map(s.grid);
      // Beim Typ-Wechsel forced zurücksetzen
      g.set(key(x, y), { type, state, forced: false });
      return { grid: g };
    });
  },

  deleteCell: (x, y) => {
    if (!batchActive) get().pushUndo();
    set(s => {
      const g = new Map(s.grid); g.delete(key(x, y)); return { grid: g };
    });
  },

  toggleState: (x, y) => set(s => {
    const g = new Map(s.grid); toggleCellState(g, x, y); return { grid: g };
  }),

  toggleForced: (x, y) => {
    if (!batchActive) get().pushUndo();
    set(s => {
      const k    = key(x, y);
      const cell = s.grid.get(k);
      if (!cell) return {};
      const g         = new Map(s.grid);
      const nowForced = !cell.forced;
      // forced=true → state=true (Zelle ist AN und bleibt AN)
      // forced=false → state=false (Zelle zerfällt ohne Treiber)
      g.set(k, { ...cell, forced: nowForced, state: nowForced });
      return { grid: g };
    });
  },

  step: () => {
    try {
      const newGrid = simulationStep(get().grid);
      set(s => ({ grid: newGrid, stepCount: s.stepCount + 1, loopError: null }));
    } catch (e) {
      if (e instanceof SimLoopError) set({ isRunning: false, loopError: e.message });
      else throw e;
    }
  },

  setRunning: v  => set({ isRunning: v, ...(v && { loopError: null }) }),
  setHz:      v  => set({ hz: v }),

  clear: () => {
    get().pushUndo();
    // Die Selektion bezieht sich auf einen Grid-Zustand, der hier komplett
    // gelöscht wird — aufheben, sonst zeigt "selected" auf Zellen, die im
    // neuen (leeren) Grid gar nicht mehr existieren.
    useSelectionStore.getState().clearSelection();
    set({ grid: new Map(), stepCount: 0, isRunning: false, loopError: null });
  },

  loadGrid: g => set({ grid: g, stepCount: 0, isRunning: false, loopError: null }),

  deleteCells: keys => {
    if (!batchActive) get().pushUndo();
    set(s => {
      const g = new Map(s.grid);
      for (const k of keys) g.delete(k);
      return { grid: g };
    });
  },

  pasteCells: (cells, atX, atY) => {
    // Leeres Array (z. B. wenn eine Duplizieren-Operation aus irgendeinem
    // Grund keine gültigen Zellen kopiert bekam) → No-Op statt einen
    // Undo-Schritt für nichts zu verbrauchen.
    if (cells.length === 0) return new Set();
    const g0 = get().grid;
    const targetKeys = cells.map(c => key(atX + c.dx, atY + c.dy));
    // Einfügen erzeugt IMMER neue Zellen — "eigene" Keys gibt es hier nicht
    // (anders als bei Rotieren/Spiegeln/Verschieben, die eine bestehende
    // Auswahl umformen). Jede Kollision blockiert daher vollständig.
    if (collidesWithForeign(g0, targetKeys, new Set())) return null;
    if (!batchActive) get().pushUndo();
    const newKeys = new Set<string>();
    set(s => {
      const g = new Map(s.grid);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        g.set(targetKeys[i], { type: c.type, state: c.state, forced: c.forced });
        newKeys.add(targetKeys[i]);
      }
      return { grid: g };
    });
    return newKeys;
  },

  rotateCells: (keys, dir) => {
    const newKeys = rotateKeys(keys, dir);
    if (collidesWithForeign(get().grid, newKeys, keys)) return null;
    if (!batchActive) get().pushUndo();
    set(s => ({ grid: remapCells(s.grid, keys, newKeys) }));
    return newKeys;
  },

  mirrorCells: (keys, axis) => {
    const newKeys = mirrorKeys(keys, axis);
    if (collidesWithForeign(get().grid, newKeys, keys)) return null;
    if (!batchActive) get().pushUndo();
    set(s => ({ grid: remapCells(s.grid, keys, newKeys) }));
    return newKeys;
  },

  beginSelectionDrag: keys => {
    dragSnapshot = { grid: get().grid, keys, moved: false };
  },

  dragSelectionTo: (dx, dy) => {
    if (!dragSnapshot) return false;
    const { grid: base, keys } = dragSnapshot;
    const newKeys = translateKeys(keys, dx, dy);
    if (collidesWithForeign(base, newKeys, keys)) return false;
    set({ grid: remapCells(base, keys, newKeys) });
    useSelectionStore.getState().setSelection(newKeys);
    if (dx !== 0 || dy !== 0) dragSnapshot.moved = true;
    return true;
  },

  endSelectionDrag: () => {
    if (!dragSnapshot) return;
    const { grid: base, moved } = dragSnapshot;
    if (moved) {
      set(s => {
        const stack = [...s.undoStack, base];
        if (stack.length > MAX_UNDO) stack.shift();
        return { undoStack: stack, redoStack: [] };
      });
    }
    dragSnapshot = null;
  },

  cancelSelectionDrag: () => {
    if (!dragSnapshot) return;
    set({ grid: dragSnapshot.grid });
    useSelectionStore.getState().setSelection(dragSnapshot.keys);
    dragSnapshot = null;
  },

  pushUndo: () => set(s => {
    const stack = [...s.undoStack, s.grid];
    if (stack.length > MAX_UNDO) stack.shift();
    // Neue Aktion → alter Redo-Pfad wird ungültig
    return { undoStack: stack, redoStack: [] };
  }),

  beginBatch: () => { batchActive = true; },
  endBatch:   () => { batchActive = false; },

  undo: () => set(s => {
    if (s.undoStack.length === 0) return {};
    useSelectionStore.getState().clearSelection();
    const prev  = s.undoStack[s.undoStack.length - 1];
    const stack = s.undoStack.slice(0, -1);
    return {
      grid:      prev,
      undoStack: stack,
      redoStack: [...s.redoStack, s.grid],
    };
  }),

  redo: () => set(s => {
    if (s.redoStack.length === 0) return {};
    useSelectionStore.getState().clearSelection();
    const next  = s.redoStack[s.redoStack.length - 1];
    const stack = s.redoStack.slice(0, -1);
    return {
      grid:      next,
      redoStack: stack,
      undoStack: [...s.undoStack, s.grid],
    };
  }),
}));
