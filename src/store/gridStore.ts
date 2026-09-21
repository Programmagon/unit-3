import { create } from 'zustand';
import type { Grid, CellType } from '../simulation/types';
import { key, toggleCellState } from '../simulation/grid';
import { simulationStep, SimLoopError } from '../simulation/engine';
// Laufzeit-Import (bewusst): gridStore muss die Selektion bei Clear/Load
// zurücksetzen und bei Undo/Redo eine evtl. schwebende Selektion zuerst
// abbrechen (siehe dort) — kein struktureller Zyklus in dem Sinne, dass
// beide Module beim Laden aufeinander angewiesen wären: alle Zugriffe
// hier passieren erst LAUFZEIT-seitig, innerhalb von Aktionsfunktionen,
// nachdem beide Module bereits fertig ausgewertet sind. selectionStore.ts
// importiert umgekehrt useGridStore für seine Grid-Lese-/Schreibzugriffe
// (commitGridChange/replaceGridSilently) — ebenfalls nur innerhalb von
// Aktionsfunktionen, nie beim Modul-Top-Level. ES-Module vertragen das.
import { useSelectionStore } from './selectionStore';

/** Maximale Größe von Undo-/Redo-Stack — älteste Einträge fallen heraus. */
const MAX_UNDO = 60;

/**
 * Rein intern, bewusst außerhalb des Stores (kein Re-Render nötig wenn sich
 * das ändert). true während eines Drags (siehe Canvas.tsx onDragStart/onDragEnd) —
 * verhindert, dass jede einzelne Zelle einer Bresenham-Drag-Linie ihren
 * eigenen Undo-Schritt pusht statt einen gemeinsamen für den ganzen Drag.
 * Betrifft NUR das Platzieren/Löschen per Cable/Inverter/Delay/Löschen-
 * Werkzeug — die Selektion (siehe selectionStore.ts) braucht das nicht:
 * dort passiert während eines Drags/Rotierens/Spiegelns gar keine
 * Grid-Mutation, erst der finale commitFloating() schreibt (in einem
 * Rutsch, mit explizitem eigenen Undo-Ziel) ins Grid.
 */
let batchActive = false;

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

  /**
   * Ersetzt das Grid OHNE Undo/Redo anzufassen — ausschließlich für die
   * interne Buchführung einer schwebenden Selektion (Anheben: Quelle
   * leeren; Abbrechen: Quelle wiederherstellen). Diese Zwischenschritte
   * sollen bewusst KEINE History-Spur hinterlassen — erst commitGridChange
   * (unten) markiert den Punkt, an dem tatsächlich etwas passiert ist.
   */
  replaceGridSilently: (g: Grid) => void;
  /**
   * Schreibt `newGrid` als neuen Live-Zustand und pusht `undoTarget` als
   * GENAU EINEN Undo-Schritt (Redo-Stack wird geleert). Für Aktionen, die
   * mehrere Zwischenschritte (Anheben, Drehen, Spiegeln, Verschieben) zu
   * einem einzigen, sauberen Undo-Schritt bündeln müssen — siehe
   * selectionStore.ts commitFloating()/deleteSelectionContents().
   */
  commitGridChange: (newGrid: Grid, undoTarget: Grid) => void;

  /** Speichert den aktuellen Grid-Zustand auf dem Undo-Stack (max. 60). */
  pushUndo:   () => void;
  /** Startet einen Batch (Drag) — Mutationen darin pushen keinen eigenen Undo-Schritt. */
  beginBatch: () => void;
  /** Beendet den Batch — einzelne Mutationen pushen wieder normal. */
  endBatch:   () => void;
  /**
   * Letzten Zustand wiederherstellen. Schwebt gerade eine Selektion, wird
   * NUR diese abgebrochen (cancelFloating(), kein History-Eintrag berührt)
   * — erst ein ZWEITER Undo bewegt sich dann durch die echte History. Ohne
   * diese Regel könnte ein Undo mitten in einer noch nicht committeten
   * Verschiebung/Drehung Grid-Historie überspringen, die mit der gerade
   * offenen Geste gar nichts zu tun hat.
   */
  undo: () => void;
  /** Zurückgeholten Zustand wiederherstellen — gleiche Schwebend-zuerst-Regel wie undo(). */
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
    // Das ganze Grid wird ersetzt — eine evtl. bestehende Selektion bezieht
    // sich auf Daten, die es gleich nicht mehr gibt. Direkt auf idle statt
    // über cancelFloating/escape: ein Restore-Versuch wäre hier sinnlos.
    useSelectionStore.getState().resetToIdle();
    set({ grid: new Map(), stepCount: 0, isRunning: false, loopError: null });
  },

  loadGrid: g => {
    useSelectionStore.getState().resetToIdle();
    set({ grid: g, stepCount: 0, isRunning: false, loopError: null });
  },

  replaceGridSilently: g => set({ grid: g }),

  commitGridChange: (newGrid, undoTarget) => set(s => {
    const stack = [...s.undoStack, undoTarget];
    if (stack.length > MAX_UNDO) stack.shift();
    return { undoStack: stack, redoStack: [], grid: newGrid };
  }),

  pushUndo: () => set(s => {
    const stack = [...s.undoStack, s.grid];
    if (stack.length > MAX_UNDO) stack.shift();
    // Neue Aktion → alter Redo-Pfad wird ungültig
    return { undoStack: stack, redoStack: [] };
  }),

  beginBatch: () => { batchActive = true; },
  endBatch:   () => { batchActive = false; },

  undo: () => {
    if (useSelectionStore.getState().selection.status === 'floating') {
      useSelectionStore.getState().cancelFloating();
      return;
    }
    set(s => {
      if (s.undoStack.length === 0) return {};
      useSelectionStore.getState().resetToIdle();
      const prev  = s.undoStack[s.undoStack.length - 1];
      const stack = s.undoStack.slice(0, -1);
      return { grid: prev, undoStack: stack, redoStack: [...s.redoStack, s.grid] };
    });
  },

  redo: () => {
    if (useSelectionStore.getState().selection.status === 'floating') {
      useSelectionStore.getState().cancelFloating();
      return;
    }
    set(s => {
      if (s.redoStack.length === 0) return {};
      useSelectionStore.getState().resetToIdle();
      const next  = s.redoStack[s.redoStack.length - 1];
      const stack = s.redoStack.slice(0, -1);
      return { grid: next, redoStack: stack, undoStack: [...s.undoStack, s.grid] };
    });
  },
}));
