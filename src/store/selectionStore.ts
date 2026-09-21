import { create } from 'zustand';
import type { Grid, CellType } from '../simulation/types';
import { fromKey } from '../simulation/grid';
import { boundingBox } from '../canvas/selection';

/** Zelle relativ zu ihrem Anker (oben-links der Bounding Box) — für Zwischenablage. */
export interface ClipboardCell {
  dx: number; dy: number;
  type: CellType; state: boolean; forced: boolean;
}

interface SelectionStore {
  selected:  Set<string>;
  clipboard: ClipboardCell[] | null;
  /**
   * Angesammelte, noch nicht ins Grid geschriebene Verschiebung seit dem
   * letzten Finalisieren. {0,0} = nichts schwebt gerade. Siehe
   * store/selectionOps.ts (finalizePendingMove) für die Schreib-Logik.
   */
  pendingOffset: { dx: number; dy: number };

  setSelection:     (keys: Set<string>) => void;
  clearSelection:   () => void;
  setPendingOffset: (o: { dx: number; dy: number }) => void;
  /** Ersetzt die Zwischenablage direkt — z. B. nach Import einer .u3sel-Datei. */
  setClipboard:     (cells: ClipboardCell[]) => void;

  /** Liest die aktuell selektierten Zellen aus dem Grid in die Zwischenablage. */
  copyToClipboard: (grid: Grid) => void;
}

/**
 * Verwaltet AUSSCHLIESSLICH was gerade markiert ist und die Zwischenablage.
 * Mutiert das Grid NICHT selbst — Grid-Mutationen (Verschieben, Löschen,
 * Einfügen, Rotieren, Spiegeln) laufen zentral über gridStore-Aktionen,
 * die den bestehenden Undo/Batch-Mechanismus nutzen. Keine doppelte
 * Undo-Logik hier.
 */
export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selected:      new Set(),
  clipboard:     null,
  pendingOffset: { dx: 0, dy: 0 },

  setSelection:   keys => set({ selected: keys }),
  // Eine aufgehobene Selektion kann keine schwebende Verschiebung mehr
  // "besitzen" — clearSelection setzt pendingOffset IMMER mit zurück.
  clearSelection: () => set({ selected: new Set(), pendingOffset: { dx: 0, dy: 0 } }),
  setPendingOffset: o => set({ pendingOffset: o }),
  setClipboard:     cells => set({ clipboard: cells }),

  copyToClipboard: grid => {
    const { selected } = get();
    if (selected.size === 0) return;
    const { minX, minY } = boundingBox(selected);
    const cells: ClipboardCell[] = [];
    for (const k of selected) {
      const cell = grid.get(k);
      if (!cell) continue; // Selektion kann leere Positionen enthalten
      const [x, y] = fromKey(k);
      cells.push({
        dx: x - minX, dy: y - minY,
        type: cell.type, state: cell.state, forced: cell.forced ?? false,
      });
    }
    set({ clipboard: cells });
  },
}));
