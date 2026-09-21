// Kein React-Import — reine Logik!
import type { Grid, CellType } from "../simulation/types";
import { key } from "../simulation/grid";
import {
  getCellAt,
  clientToCanvas,
  zoomAtPoint,
  type Camera,
} from "./coordinates";

export type Tool = CellType | "delete" | "select";

// ─── applyTool ────────────────────────────────────────────────────────
// Hinweis: aktuell ungenutzt (Canvas.tsx implementiert die Platzier-Logik
// inline in seinem onPlace-Callback). Parameter-Typ bewusst auf CellType |
// 'delete' verengt — diese Funktion kannte 'select' nie und war dafür auch
// nie gedacht (Selektion läuft komplett über den isolierten select-Zweig
// im PointerController, nicht über applyTool).
export function applyTool(
  grid: Grid,
  cx: number,
  cy: number,
  tool: CellType | "delete",
  isDrag = false
): boolean {
  const k = key(cx, cy);
  if (tool === "delete") {
    if (!grid.has(k)) return false;
    grid.delete(k);
    return true;
  }
  if (!grid.has(k)) {
    grid.set(k, { type: tool, state: false });
    return true;
  }
  if (!isDrag) {
    const cell = grid.get(k)!;
    if (cell.type === tool) {
      grid.set(k, { ...cell, state: !cell.state });
    } else {
      grid.set(k, { type: tool, state: cell.state });
    }
    return true;
  }
  return false;
}

// ─── Bresenham-Liniensegment ──────────────────────────────────────────
/**
 * Gibt alle Gitterzellen auf dem Segment (x0,y0)→(x1,y1) zurück.
 * Wird genutzt um Lücken bei schnellen Pointer-Bewegungen zu füllen.
 */
function bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [number, number][] {
  const cells: [number, number][] = [];
  const dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy,
    x = x0,
    y = y0;
  while (true) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

// ─── Konstanten ───────────────────────────────────────────────────────
/** Pixel-Bewegung ab pointerdown bis Drag beginnt (gerätespezifisch) */
const TAP_THRESHOLD: Record<string, number> = {
  mouse: 5, // Maus: präzise, 5px reichen
  touch: 12, // Finger: ungenau, größere Toleranz
  pen: 8,
};
const DEFAULT_TAP_THRESHOLD = 8;

/** ms bis Long-Press-Löschen auf Touch aktiv wird */
const LONG_PRESS_MS = 450;

/**
 * Mindest-Verhältnis dominante/nicht-dominante Achsenbewegung vor Achslock.
 * 1.5 = dominante Achse muss 50% mehr Bewegung haben als die andere.
 * Verhindert versehentliches Sperren bei diagonaler Touch-Bewegung.
 */
const AXIS_DOMINANCE_RATIO = 1.5;

/** Mindestabstand vom Ankerpunkt (in Zellen) bevor Achse gesperrt wird */
const AXIS_MIN_CELLS = 2;

// ─── Interner Pointer-Zustand ─────────────────────────────────────────
interface PointerInfo {
  id: number;
  type: string;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
}

// ─── Callbacks ────────────────────────────────────────────────────────
export interface PointerCallbacks {
  onPlace: (cx: number, cy: number, isDrag: boolean) => void;
  onDelete: (cx: number, cy: number) => void;
  /** Delta in Canvas-Pixel — Empfänger mutiert Camera direkt */
  onPan: (dx: number, dy: number) => void;
  /** Faktor + Fokuspunkt in Canvas-Pixel — Empfänger mutiert Camera direkt */
  onZoom: (factor: number, focalSx: number, focalSy: number) => void;
  /** Wird beim Übergang !isDragging → isDragging aufgerufen (einmal pro Drag) */
  onDragStart?: () => void;
  /** Wird bei pointerUp/pointerCancel aufgerufen, wenn zuvor gedraggt wurde */
  onDragEnd?: () => void;

  // ─── Selektions-Werkzeug (Schritt 5) ──────────────────────────────
  /**
   * Rechteckauswahl fertig gezogen (Weltkoordinaten, committed).
   * modifier: 'replace' (normal), 'add' (Shift-gezogen), 'subtract' (Alt-gezogen).
   */
  onSelectRect?: (x0: number, y0: number, x1: number, y1: number, modifier: 'replace' | 'add' | 'subtract') => void;
  /**
   * Live-Vorschau während des Aufziehens eines neuen Rechtecks (Weltkoordinaten).
   * Nicht im ursprünglichen Callback-Satz der Spec, aber notwendig: renderer.ts'
   * renderSelectionOverlay() braucht laufend aktuelle activeDragRect-Daten für
   * den gestrichelten Rahmen WÄHREND des Ziehens, nicht erst danach.
   */
  onSelectRectPreview?: (x0: number, y0: number, x1: number, y1: number) => void;
  /** Tap außerhalb der aktuellen Selektion (kein Drag) → Selektion aufheben. */
  onSelectClear?: () => void;
  /** Verschiebung einer bestehenden Selektion — Vorschau, noch nicht committed. */
  onSelectMovePreview?: (dx: number, dy: number) => void;
  /** Verschiebung committed (pointerUp nach Selektions-Drag). */
  onSelectMoveCommit?: (dx: number, dy: number) => void;
  /**
   * Wird aufgerufen BEVOR eine genuine neue Rechteckauswahl beginnt (d. h.
   * der Tap trifft NICHT die aktuelle — ggf. schwebende — Selektion, oder
   * eine Modifier-Taste war gehalten). Eine evtl. noch nicht ins Grid
   * geschriebene Verschiebung muss vorher finalisiert werden (siehe
   * store/selectionOps.ts finalizePendingMove).
   */
  onSelectFinalize?: () => void;
  /**
   * Rechteck- oder Verschiebe-Vorschau abgebrochen ohne Commit (z. B. wenn ein
   * zweiter Finger während eines Selektions-Drags aufsetzt → Pinch übernimmt).
   * Nicht im ursprünglichen Callback-Satz, aber nötig damit keine "Geister"-
   * Vorschau (previewOffset/activeDragRect) hängen bleibt.
   */
  onSelectCancel?: () => void;
}

// ─── PointerController ────────────────────────────────────────────────
export class PointerController {
  private readonly pointers = new Map<number, PointerInfo>();
  private readonly cb: PointerCallbacks;
  private readonly canvas: HTMLCanvasElement;
  private readonly getCamera: () => Camera;
  private readonly getTool: () => Tool | null;
  private readonly getSelectionHit: (cx: number, cy: number) => boolean;

  // Einzel-Pointer-Zustand
  private isPanning = false;
  private isDragging = false;
  private isDeleting = false;
  private dragAxis: "x" | "y" | null = null;
  private anchorCell: [number, number] | null = null;
  /** Letzte platzierte Zelle — Startpunkt für Bresenham-Interpolation */
  private lastCellPos: [number, number] | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Selektions-Zustand ───────────────────────────────────────────
  // Eigene Felder, KEINE Wiederverwendung von isDragging/anchorCell/
  // lastCellPos (die gehören zum Platzier-/Lösch-Pfad) — der select-Zweig
  // ist strikt isoliert, kein gemeinsamer Codepfad mit dem Platzieren.
  private selectMode: "rect" | "move" | null = null;
  private selectAnchor: [number, number] | null = null;
  private selectDidDrag = false;
  /** Gesetzt in pointerDown (Schritt 5b, Punkt 5 — Multi-Select), an onSelectRect durchgereicht. */
  private selectModifier: "replace" | "add" | "subtract" = "replace";

  // Pinch-Zustand
  private pinchDist = 0;
  private pinchMidSx = 0;
  private pinchMidSy = 0;
  /**
   * Verhindert Tap-Auslösung beim Loslassen nach einem Pinch.
   * Problem: resetSinglePointerState() löscht isPanning/isDragging/isDeleting —
   * danach sieht jedes pointerUp wie ein unberührter Tap aus, auch nach Pinch-Zoom.
   * Dieses Flag liegt außerhalb von resetSinglePointerState() und wird erst
   * gelöscht wenn alle Pointer weg sind.
   */
  private wasPinching = false;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PointerCallbacks,
    getCamera: () => Camera,
    getTool: () => Tool | null,
    getSelectionHit: (cx: number, cy: number) => boolean
  ) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.getCamera = getCamera;
    this.getTool = getTool;
    this.getSelectionHit = getSelectionHit;
  }

  // ─── Hilfsfunktionen ────────────────────────────────────────────────

  private cellAt(clientX: number, clientY: number): [number, number] {
    return getCellAt(clientX, clientY, this.canvas, this.getCamera());
  }
  private ck(c: [number, number]) {
    return `${c[0]},${c[1]}`;
  }

  private tapThreshold(pointerType: string): number {
    return TAP_THRESHOLD[pointerType] ?? DEFAULT_TAP_THRESHOLD;
  }

  private shouldPan(e: PointerEvent): boolean {
    // Kein Werkzeug aktiv → JEDE Eingabe pannt (alle Maustasten, ein Finger
    // auf Touch) — dieser Check läuft in pointerDown VOR Selektion,
    // Rechtsklick-Löschen und Long-Press-Löschen, daher genügt der einfache
    // Vorrang hier, ohne diese anderen Zweige einzeln absichern zu müssen.
    if (this.getTool() === null) return true;
    // BUGFIX: Beim Auswählen-Werkzeug ist Alt bereits als Abziehen-Modifier
    // belegt (siehe pointerDown select-Zweig: modifierHeld/selectModifier).
    // Ohne diese Ausnahme fing dieser Check JEDES Alt+Maus-Drag vorher als
    // Schwenken ab, bevor der Selektions-Zweig überhaupt erreicht wurde —
    // der Abziehen-Modifier war über Maus dadurch praktisch unerreichbar
    // (Touch/Stift kennen kein Alt und waren nicht betroffen). Mittlere
    // Maustaste bleibt als Pan-Auslöser bestehen, die kollidiert mit nichts.
    if (this.getTool() === "select") {
      return e.pointerType === "mouse" && e.button === 1;
    }
    return e.pointerType === "mouse" && (e.button === 1 || e.altKey);
  }

  private cancelLongPress() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private resetSinglePointerState() {
    this.isPanning = false;
    this.isDragging = false;
    this.isDeleting = false;
    this.dragAxis = null;
    this.anchorCell = null;
    this.lastCellPos = null;
    this.cancelLongPress();
  }

  /**
   * Verankert den verbleibenden Pointer neu, wenn von 2 auf 1 Finger
   * reduziert wird (Pinch-Ende).
   * Ohne dies bleibt startClientX/Y auf der Position von VOR dem Pinch
   * stehen. pointerMove berechnet die Tap/Drag-Schwelle dann gegen diese
   * veraltete Position — die Pinch-Bewegung selbst überschreitet die
   * Schwelle sofort, wodurch fälschlich ein Drag beginnt und im selben
   * Move-Event eine Zelle an der alten Ankerposition platziert wird.
   * Das war der Mobile-Bug: Zoomen platzierte Zellen.
   */
  private reanchorRemainingPointer() {
    if (this.pointers.size !== 1) return;
    const remaining = [...this.pointers.values()][0];
    remaining.startClientX = remaining.lastClientX;
    remaining.startClientY = remaining.lastClientY;
  }

  // ─── Drag-Platzieren: Bresenham + Achslock ──────────────────────────

  /**
   * Berechnet Zielzelle, wendet Achslock an (nur beim Platzieren),
   * und interpoliert mit Bresenham zwischen letzter und aktueller Zelle.
   */
  private applyDragAt(clientX: number, clientY: number) {
    let [cx, cy] = this.cellAt(clientX, clientY);

    // Achslock — NUR beim Platzieren, nicht beim Löschen
    // isDeleting-Flag deckt nur Rechtsklick-Drag (PC) und Long-Press-Drag
    // (Touch) ab. Löschen per Toolbar-Werkzeug + normalem Drag läuft über
    // den generischen isDragging-Pfad und setzt isDeleting nie — deshalb
    // zusätzlich getTool() prüfen, sonst wird auf Mobile beim Löschen
    // trotzdem gestraightet.
    const deleting = this.isDeleting || this.getTool() === "delete";
    if (!deleting && this.anchorCell !== null) {
      if (this.dragAxis === null) {
        const adx = Math.abs(cx - this.anchorCell[0]);
        const ady = Math.abs(cy - this.anchorCell[1]);
        const dominant = Math.max(adx, ady);
        // Achse erst sperren wenn Bewegung eindeutig genug ist:
        // min. AXIS_MIN_CELLS Abstand UND klare Dominanz (AXIS_DOMINANCE_RATIO)
        if (dominant >= AXIS_MIN_CELLS) {
          if (adx > ady * AXIS_DOMINANCE_RATIO) this.dragAxis = "x";
          else if (ady > adx * AXIS_DOMINANCE_RATIO) this.dragAxis = "y";
          // Diagonal → Achse noch offen, nächste Bewegung entscheidet
        }
      }
      if (this.dragAxis === "x") cy = this.anchorCell[1]; // horizontal → Y klemmen
      if (this.dragAxis === "y") cx = this.anchorCell[0]; // vertikal  → X klemmen
    }

    // Bresenham-Interpolation: alle Zellen zwischen lastCellPos und (cx,cy)
    const from = this.lastCellPos ?? [cx, cy];
    const path = bresenham(from[0], from[1], cx, cy);

    // Ersten Eintrag überspringen (= lastCellPos, bereits verarbeitet)
    const start = this.lastCellPos !== null ? 1 : 0;
    for (let i = start; i < path.length; i++) {
      const [ix, iy] = path[i];
      if (this.isDeleting) this.cb.onDelete(ix, iy);
      else this.cb.onPlace(ix, iy, true);
    }

    this.lastCellPos = [cx, cy];
  }

  // ─── Pinch ──────────────────────────────────────────────────────────

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.hypot(
      b.lastClientX - a.lastClientX,
      b.lastClientY - a.lastClientY
    );
    const [mx, my] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2,
      this.canvas
    );
    this.pinchMidSx = mx;
    this.pinchMidSy = my;
  }

  private updatePinch() {
    if (this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const newDist = Math.hypot(
      b.lastClientX - a.lastClientX,
      b.lastClientY - a.lastClientY
    );
    const [newMx, newMy] = clientToCanvas(
      (a.lastClientX + b.lastClientX) / 2,
      (a.lastClientY + b.lastClientY) / 2,
      this.canvas
    );
    if (this.pinchDist > 0)
      this.cb.onZoom(newDist / this.pinchDist, newMx, newMy);
    this.cb.onPan(newMx - this.pinchMidSx, newMy - this.pinchMidSy);
    this.pinchDist = newDist;
    this.pinchMidSx = newMx;
    this.pinchMidSy = newMy;
  }

  // ─── Öffentliche Event-Handler ──────────────────────────────────────

  pointerDown(e: PointerEvent) {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const p: PointerInfo = {
      id: e.pointerId,
      type: e.pointerType,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
    };
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      this.resetSinglePointerState();
      if (this.selectMode !== null) {
        this.cb.onSelectCancel?.();
        this.selectMode = null;
        this.selectAnchor = null;
        this.selectDidDrag = false;
      }
      this.wasPinching = true;
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.resetSinglePointerState();
    // Defensiver Reset — sollte durch pointerUp/pointerCancel bereits null sein.
    this.selectMode = null;
    this.selectAnchor = null;
    this.selectDidDrag = false;

    if (this.shouldPan(e)) {
      this.isPanning = true;
      return;
    }

    // ─── Selektions-Werkzeug: früh abzweigen, strikt isoliert ─────────
    // Kein gemeinsamer Codepfad mit Platzieren/Löschen — Rechtsklick- und
    // Long-Press-Löschen unten werden für tool='select' nie erreicht.
    if (this.getTool() === "select") {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      // Shift/Alt gehalten → IMMER neue Rechteckauswahl, Hit-Test der
      // bestehenden Selektion wird ignoriert (wer eine Modifier-Taste hält,
      // will die Auswahl anpassen, nicht etwas verschieben).
      const modifierHeld = e.shiftKey || e.altKey;
      const isHit = !modifierHeld && this.getSelectionHit(cx, cy);
      if (!isHit) {
        // Genuine neue Rechteckauswahl beginnt → evtl. schwebende
        // Verschiebung MUSS vorher finalisiert werden.
        this.cb.onSelectFinalize?.();
      }
      this.selectAnchor = [cx, cy];
      this.selectMode = isHit ? "move" : "rect";
      this.selectModifier = e.shiftKey ? "add" : e.altKey ? "subtract" : "replace";
      return;
    }

    // Rechtsklick → sofort Löschen-Drag
    if (e.pointerType === "mouse" && e.button === 2) {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.isDeleting = true;
      this.isDragging = true;
      this.anchorCell = [cx, cy];
      this.lastCellPos = [cx, cy];
      this.cb.onDragStart?.();
      this.cb.onDelete(cx, cy);
      return;
    }

    // Long-Press → Löschen auf Touch/Stift
    if (e.pointerType !== "mouse") {
      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      this.longPressTimer = setTimeout(() => {
        if (!this.isDragging) {
          this.cancelLongPress();
          this.isDeleting = true;
          this.isDragging = true;
          this.anchorCell = [cx, cy];
          this.lastCellPos = [cx, cy];
          this.cb.onDragStart?.();
          this.cb.onDelete(cx, cy);
        }
      }, LONG_PRESS_MS);
    }
  }

  pointerMove(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.lastClientX,
      prevY = p.lastClientY;
    p.lastClientX = e.clientX;
    p.lastClientY = e.clientY;

    if (this.pointers.size >= 2) {
      this.updatePinch();
      return;
    }

    // ─── Selektions-Werkzeug: strikt isoliert ─────────────────────────
    if (this.selectMode !== null) {
      const dist = Math.hypot(
        e.clientX - p.startClientX,
        e.clientY - p.startClientY
      );
      if (!this.selectDidDrag && dist >= this.tapThreshold(p.type)) {
        this.selectDidDrag = true;
      }
      if (!this.selectDidDrag) return; // noch unentschieden: Tap oder Drag?

      const [cx, cy] = this.cellAt(e.clientX, e.clientY);
      const anchor = this.selectAnchor!;
      if (this.selectMode === "rect") {
        this.cb.onSelectRectPreview?.(anchor[0], anchor[1], cx, cy);
      } else {
        this.cb.onSelectMovePreview?.(cx - anchor[0], cy - anchor[1]);
      }
      return;
    }

    // Pan
    if (this.isPanning) {
      const [prevSx, prevSy] = clientToCanvas(prevX, prevY, this.canvas);
      const [curSx, curSy] = clientToCanvas(e.clientX, e.clientY, this.canvas);
      this.cb.onPan(curSx - prevSx, curSy - prevSy);
      return;
    }

    // Löschen-Drag
    if (this.isDeleting) {
      this.applyDragAt(e.clientX, e.clientY);
      return;
    }

    // Tap-vs-Drag-Schwelle (gerätespezifisch)
    const dist = Math.hypot(
      e.clientX - p.startClientX,
      e.clientY - p.startClientY
    );
    if (dist >= this.tapThreshold(p.type)) {
      this.cancelLongPress();

      if (!this.isDragging) {
        this.isDragging = true;
        const [cx, cy] = this.cellAt(p.startClientX, p.startClientY);
        this.anchorCell = [cx, cy];
        this.lastCellPos = [cx, cy]; // Startpunkt für Bresenham
        this.cb.onDragStart?.();
        // Ankerzelle wie Tap behandeln (Toggle erlaubt)
        if (this.getTool() !== "delete") this.cb.onPlace(cx, cy, false);
      }
      this.applyDragAt(e.clientX, e.clientY);
    }
  }

  pointerUp(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.cancelLongPress();
    this.pointers.delete(e.pointerId);
    this.reanchorRemainingPointer();

    // ─── Selektions-Werkzeug: strikt isoliert ─────────────────────────
    if (this.selectMode !== null) {
      if (this.pointers.size === 0) {
        const anchor = this.selectAnchor!;
        if (this.selectDidDrag) {
          const [cx, cy] = this.cellAt(e.clientX, e.clientY);
          if (this.selectMode === "rect") {
            this.cb.onSelectRect?.(anchor[0], anchor[1], cx, cy, this.selectModifier);
          } else {
            const dx = cx - anchor[0], dy = cy - anchor[1];
            // Nulldelta nicht committen — kein leerer Undo-Schritt für
            // eine Selektion, die nur angetippt, aber nie bewegt wurde.
            if (dx !== 0 || dy !== 0) this.cb.onSelectMoveCommit?.(dx, dy);
          }
        } else if (this.selectMode === "rect") {
          // Reiner Tap außerhalb der Selektion (kein Hit, keine Bewegung) → aufheben.
          this.cb.onSelectClear?.();
        }
        // Reiner Tap im 'move'-Modus ohne Bewegung → No-Op, Selektion bleibt.
        this.selectMode = null;
        this.selectAnchor = null;
        this.selectDidDrag = false;
      }
      return;
    }

    if (this.pointers.size <= 1) {
      const wasTap =
        !this.isPanning &&
        !this.isDragging &&
        !this.isDeleting &&
        !this.wasPinching;
      if (wasTap && this.pointers.size === 0) {
        const [cx, cy] = this.cellAt(e.clientX, e.clientY);
        if (e.pointerType === "mouse" && e.button === 2)
          this.cb.onDelete(cx, cy);
        else this.cb.onPlace(cx, cy, false);
      }
      if (this.pointers.size === 0) {
        if (this.isDragging) this.cb.onDragEnd?.();
        this.wasPinching = false;
        this.resetSinglePointerState();
      }
    }
  }

  pointerCancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.cancelLongPress();
    this.reanchorRemainingPointer();

    if (this.selectMode !== null) {
      if (this.pointers.size === 0) {
        this.cb.onSelectCancel?.();
        this.selectMode = null;
        this.selectAnchor = null;
        this.selectDidDrag = false;
      }
      return;
    }

    if (this.pointers.size === 0) {
      if (this.isDragging) this.cb.onDragEnd?.();
      this.wasPinching = false;
      this.resetSinglePointerState();
    }
  }

  wheel(e: WheelEvent) {
    const [sx, sy] = clientToCanvas(e.clientX, e.clientY, this.canvas);
    this.cb.onZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, sx, sy);
  }
}