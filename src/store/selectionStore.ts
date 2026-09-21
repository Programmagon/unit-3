import { create } from 'zustand';
import { useGridStore } from './gridStore';
import {
  type Point, type Rect, type Buffer, type SelectionState,
  normalizeMarquee, pointInRect, recenterRect, centeredAnchor, bufferBounds,
  rotateBufferCW, rotateBufferCCW, flipBufferH, flipBufferV,
  extractRegion, extractAndClear, stampBuffer, cloneBuffer,
} from '../canvas/selection';

/** Zwischenablage braucht die Maße getrennt vom (sparse) Buffer, um beim
 *  Einfügen zentrieren zu können — ein dichtes Grid hätte diese Info
 *  implizit über seine Array-Dimensionen, unser sparse Buffer nicht. */
interface Clipboard { buffer: Buffer; width: number; height: number; }

interface SelectionStore {
  selection: SelectionState;
  clipboard: Clipboard | null;

  // ── Pointer-Interaktion (siehe Canvas.tsx für die Verdrahtung mit
  // canvas/input.ts — dessen Tap/Drag-Schwellen- und Pinch-Erkennung
  // bleibt unverändert zuständig, nur WAS bei jedem Schritt passiert,
  // kommt jetzt von hier). ──────────────────────────────────────────────
  /**
   * Bei Pointer-Down auf dem Auswählen-Werkzeug, BEVOR input.ts entscheidet
   * ob daraus eine neue Rechteckauswahl oder eine Verschiebung wird.
   * Übernimmt die komplette Klick-Logik: liegt der Klick außerhalb einer
   * gerade schwebenden Selektion, wird sie zuerst committed (Regel aus dem
   * Referenzprojekt: "jede andere Interaktion bestätigt eine schwebende
   * Selektion"). Liegt der (ggf. jetzt neu bewertete) Klick innerhalb einer
   * bestehenden Selektion, wird sie angehoben (ensureFloating) und true
   * zurückgegeben, damit input.ts in den Verschiebe-Modus wechselt.
   */
  resolvePointerDown: (p: Point) => boolean;
  /** Marquee-Vorschau aktualisieren (während des Aufziehens, noch nicht committed). */
  updateMarquee: (start: Point, current: Point) => void;
  /** Marquee fertig aufgezogen → wird zu 'selected'. */
  finishMarquee: (start: Point, current: Point) => void;
  /** Reiner Tap ohne Bewegung außerhalb jeder Selektion → abwählen. */
  clearSelection: () => void;
  /** Merkt sich die Rect-Position beim Start eines Verschiebe-Drags. */
  beginFloatingDrag: () => void;
  /** TOTALES Delta seit beginFloatingDrag() — nicht inkrementell (vermeidet Drift). */
  updateFloatingDrag: (dx: number, dy: number) => void;
  /** Ein laufender Drag/Marquee wird unterbrochen (z. B. Pinch übernimmt) —
   *  KEIN Abbruch der schwebenden Selektion selbst, die bleibt exakt so
   *  stehen wie zuletzt (nichts wurde geschrieben, es gibt nichts zu
   *  bereinigen); nur ein in Arbeit befindliches Marquee wird verworfen. */
  interruptInteraction: () => void;

  // ── Aktionen ─────────────────────────────────────────────────────────
  /** Hebt eine 'selected' Selektion in den schwebenden Zustand — No-Op wenn
   *  bereits schwebend oder nichts ausgewählt ist. */
  ensureFloating: () => void;
  rotateSelection: (dir: 1 | -1) => void;
  flipSelection:   (axis: 'x' | 'y') => void;
  /** Verschiebt die (ggf. erst anzuhebende) Selektion um genau eine Zelle. */
  nudgeSelection: (dx: number, dy: number) => void;
  copySelection:  () => void;
  cutSelection:   () => void;
  pasteClipboard: (anchor: Point) => void;
  /** Ersetzt die Zwischenablage direkt mit einem rohen Buffer (Maße werden
   *  aus den dx/dy-Extents berechnet) — für den Import einer .u3sel-Datei,
   *  die anders als die interne Zwischenablage keine Maße mitbringt. */
  setClipboardFromBuffer: (buffer: Buffer) => void;
  duplicateSelection: () => void;
  /** Löscht den Inhalt der Selektion (Grid bei 'selected'; bei 'floating'
   *  wird der Buffer einfach verworfen — die Quelle ist beim Anheben schon
   *  geleert worden bzw. bei "neu" nie berührt). */
  deleteSelectionContents: () => void;
  /** Schreibt eine schwebende Selektion final ins Grid — EIN Undo-Schritt
   *  für die gesamte Geste (Verschieben+Drehen+Spiegeln zusammen). */
  commitFloating: () => void;
  /** Bricht eine schwebende Selektion ab — stellt exakt den Zustand von
   *  vor dem Anheben wieder her, OHNE einen Undo-Schritt zu erzeugen. */
  cancelFloating: () => void;
  /** Escape-Taste: bei schwebender Selektion = cancelFloating(), sonst = abwählen. */
  escape: () => void;
  /** Für gridStore (Clear/Load/Undo/Redo): direkt auf idle, ohne
   *  irgendetwas wiederherzustellen — bei einem komplett ersetzten Grid
   *  wäre ein Restore-Versuch sinnlos bzw. bezöge sich auf nicht mehr
   *  existierende Daten. */
  resetToIdle: () => void;
}

/**
 * Merkt sich die Rect-Position EINMALIG bei Drag-Beginn (Maus) —
 * modul-lokal wie gridStore.ts' dragSnapshot/batchActive, kein Store-Feld,
 * da rein transiente Geste. onSelectDragStep liefert das TOTALE Delta seit
 * Drag-Beginn (siehe canvas/input.ts), nicht inkrementell — braucht daher
 * einen stabilen Bezugspunkt, der sich während des Drags nicht mitbewegt.
 */
let dragOrigin: Rect | null = null;

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selection: { status: 'idle' },
  clipboard: null,

  resolvePointerDown: p => {
    const sel = get().selection;
    if (sel.status === 'floating' && !pointInRect(p, sel.rect)) {
      get().commitFloating();
    }
    const cur = get().selection; // frisch — ggf. gerade eben committed
    if ((cur.status === 'selected' || cur.status === 'floating') && pointInRect(p, cur.rect)) {
      get().ensureFloating();
      return true;
    }
    return false;
  },

  updateMarquee: (start, current) => set({ selection: { status: 'marquee', start, current } }),

  finishMarquee: (start, current) => set({ selection: { status: 'selected', rect: normalizeMarquee(start, current) } }),

  clearSelection: () => set({ selection: { status: 'idle' } }),

  beginFloatingDrag: () => {
    const sel = get().selection;
    dragOrigin = sel.status === 'floating' ? sel.rect : null;
  },

  updateFloatingDrag: (dx, dy) => {
    const sel = get().selection;
    if (sel.status !== 'floating' || !dragOrigin) return;
    set({ selection: { ...sel, rect: { ...dragOrigin, x: dragOrigin.x + dx, y: dragOrigin.y + dy } } });
  },

  interruptInteraction: () => {
    const sel = get().selection;
    if (sel.status === 'marquee') set({ selection: { status: 'idle' } });
    // 'floating': bewusst unverändert lassen (siehe Doku oben).
    dragOrigin = null;
  },

  ensureFloating: () => {
    const sel = get().selection;
    if (sel.status === 'floating') return;
    if (sel.status !== 'selected') return;
    const { buffer, grid: cleared } = extractAndClear(useGridStore.getState().grid, sel.rect);
    useGridStore.getState().replaceGridSilently(cleared);
    set({
      selection: {
        status: 'floating',
        rect: sel.rect,
        buffer,
        origin: { kind: 'move', sourceRect: sel.rect, originalBuffer: buffer },
        returnState: sel,
      },
    });
  },

  rotateSelection: dir => {
    get().ensureFloating();
    const sel = get().selection;
    if (sel.status !== 'floating') return; // z. B. wenn nichts ausgewählt war
    const buffer = dir === 1
      ? rotateBufferCW(sel.buffer, sel.rect.height)
      : rotateBufferCCW(sel.buffer, sel.rect.width);
    const rect = recenterRect(sel.rect, sel.rect.height, sel.rect.width);
    set({ selection: { ...sel, buffer, rect } });
  },

  flipSelection: axis => {
    get().ensureFloating();
    const sel = get().selection;
    if (sel.status !== 'floating') return;
    const buffer = axis === 'x' ? flipBufferH(sel.buffer, sel.rect.width) : flipBufferV(sel.buffer, sel.rect.height);
    set({ selection: { ...sel, buffer } }); // Maße bleiben gleich, kein recenter nötig
  },

  nudgeSelection: (dx, dy) => {
    get().ensureFloating();
    const sel = get().selection;
    if (sel.status !== 'floating') return;
    set({ selection: { ...sel, rect: { ...sel.rect, x: sel.rect.x + dx, y: sel.rect.y + dy } } });
  },

  copySelection: () => {
    const sel = get().selection;
    if (sel.status === 'selected') {
      set({ clipboard: {
        buffer: cloneBuffer(extractRegion(useGridStore.getState().grid, sel.rect)),
        width: sel.rect.width, height: sel.rect.height,
      } });
    } else if (sel.status === 'floating') {
      set({ clipboard: { buffer: cloneBuffer(sel.buffer), width: sel.rect.width, height: sel.rect.height } });
    }
  },

  cutSelection: () => {
    get().copySelection();
    get().deleteSelectionContents();
  },

  setClipboardFromBuffer: buffer => {
    const { width, height } = bufferBounds(buffer);
    set({ clipboard: { buffer: cloneBuffer(buffer), width, height } });
  },

  pasteClipboard: anchor => {
    const clip = get().clipboard;
    if (!clip || clip.buffer.length === 0) return;
    // Es kann immer nur EINE Selektion gleichzeitig schweben.
    if (get().selection.status === 'floating') get().commitFloating();
    const at = centeredAnchor(clip.width, clip.height, anchor);
    set({
      selection: {
        status: 'floating',
        rect: { x: at.x, y: at.y, width: clip.width, height: clip.height },
        buffer: cloneBuffer(clip.buffer),
        origin: { kind: 'new' },
        returnState: { status: 'idle' },
      },
    });
  },

  duplicateSelection: () => {
    const sel = get().selection;
    let buffer: Buffer, baseRect: Rect;
    if (sel.status === 'selected') {
      buffer = cloneBuffer(extractRegion(useGridStore.getState().grid, sel.rect));
      baseRect = sel.rect;
    } else if (sel.status === 'floating') {
      buffer = cloneBuffer(sel.buffer);
      baseRect = sel.rect;
      get().commitFloating(); // die AKTUELLE schwebende Selektion erst fixieren
    } else {
      return;
    }
    set({
      selection: {
        status: 'floating',
        rect: { x: baseRect.x + 1, y: baseRect.y + 1, width: baseRect.width, height: baseRect.height },
        buffer,
        origin: { kind: 'new' },
        returnState: { status: 'idle' },
      },
    });
  },

  deleteSelectionContents: () => {
    const sel = get().selection;
    if (sel.status === 'selected') {
      const grid = useGridStore.getState().grid;
      const { grid: cleared } = extractAndClear(grid, sel.rect);
      useGridStore.getState().commitGridChange(cleared, grid);
      set({ selection: { status: 'idle' } });
    } else if (sel.status === 'floating') {
      // 'move': Quelle wurde beim Anheben schon geleert — das bleibt so,
      // der Buffer wird einfach verworfen (Ergebnis: Inhalt ist weg).
      // 'new': Grid wurde nie berührt, nichts zu tun.
      // In BEIDEN Fällen kein Undo-Schritt — es wurde ja nie etwas committed.
      set({ selection: { status: 'idle' } });
    }
  },

  commitFloating: () => {
    const sel = get().selection;
    if (sel.status !== 'floating') return;
    const liveGrid = useGridStore.getState().grid;
    // Undo-Ziel = Grid-Zustand von VOR dem gesamten Vorgang (Anheben +
    // beliebig viele Drehungen/Spiegelungen/Verschiebungen), rekonstruiert
    // durch Zurückschreiben des UNVERÄNDERTEN Original-Inhalts an die
    // Quellposition. Für 'new' (Einfügen/Duplizieren) wurde das Grid nie
    // angefasst — das aktuelle Grid IST bereits der Vorher-Zustand.
    const undoTarget = sel.origin.kind === 'move'
      ? stampBuffer(liveGrid, sel.origin.originalBuffer, sel.origin.sourceRect)
      : liveGrid;
    const nextGrid = stampBuffer(liveGrid, sel.buffer, sel.rect);
    useGridStore.getState().commitGridChange(nextGrid, undoTarget);
    set({ selection: { status: 'idle' } });
  },

  cancelFloating: () => {
    const sel = get().selection;
    if (sel.status !== 'floating') return;
    if (sel.origin.kind === 'move') {
      const restored = stampBuffer(useGridStore.getState().grid, sel.origin.originalBuffer, sel.origin.sourceRect);
      useGridStore.getState().replaceGridSilently(restored);
    }
    // 'new': Grid wurde nie angefasst, nichts wiederherzustellen.
    dragOrigin = null;
    set({ selection: sel.returnState });
  },

  escape: () => {
    if (get().selection.status === 'floating') { get().cancelFloating(); return; }
    set({ selection: { status: 'idle' } });
  },

  resetToIdle: () => { dragOrigin = null; set({ selection: { status: 'idle' } }); },
}));
