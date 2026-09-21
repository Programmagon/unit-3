import { forwardRef, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { useGridStore }      from '../store/gridStore';
import { useUIStore }        from '../store/uiStore';
import { useSelectionStore } from '../store/selectionStore';
import { renderFrame, renderSelectionOverlay } from '../canvas/renderer';
import { PointerController } from '../canvas/input';
import { zoomAtPoint, getCellAt } from '../canvas/coordinates';
import type { Camera }       from '../canvas/coordinates';
import type { Tool }         from '../canvas/input';
import type { SelectionState } from '../canvas/selection';

// Kamera-Startwert — lebt als Ref, kein Zustand, keine React-Re-Renders
const INITIAL_CAMERA: Camera = { x: -15, y: -9, zoom: 36 };

/**
 * Von außen (App.tsx / SimBar) erreichbare Kamera-Schnittstelle.
 * Nötig, weil die Kamera bewusst NICHT im Store lebt (siehe cameraRef unten) —
 * Save/Load braucht trotzdem Lese-/Schreibzugriff.
 */
export interface CanvasHandle {
  getCameraSnapshot: () => Camera;
  setCameraSnapshot: (cam: Camera) => void;
  /**
   * Letzte bekannte Pointer-Zellposition — null falls noch nie ein Pointer-
   * Event stattfand. Strg+V soll "an letzter bekannter Zeigerposition"
   * einfügen, aber useKeyboardShortcuts.ts hat keinen eigenen Zugriff auf
   * Pointer-Position oder Kamera (beide leben nur hier in Canvas.tsx-Refs).
   */
  getLastPointerCell: () => [number, number] | null;
  /**
   * Zell-Position in der Mitte des aktuell sichtbaren Canvas-Ausschnitts.
   * Der Einfügen-BUTTON (im Unterschied zu Strg+V, das die Mausposition
   * sinnvoll nutzen kann) hat auf Touch-Geräten kein Äquivalent zu einer
   * "Zeigerposition" — dort ist die Bildschirmmitte der einzige
   * vorhersagbare, immer sichtbare Ankerpunkt.
   */
  getViewportCenterCell: () => [number, number];
}

export const Canvas = forwardRef<CanvasHandle, object>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef   = useRef<PointerController | null>(null);

  // ── Kamera als Ref — direktes Mutieren, kein Zustand ─────────────────
  // Pan und Zoom mutieren cameraRef.current direkt und setzen dirtyRef=true.
  // Der rAF-Loop zeichnet den nächsten Frame wenn dirty — kein React-Overhead.
  const cameraRef = useRef<Camera>({ ...INITIAL_CAMERA });
  const dirtyRef  = useRef(true);
  const rafRef    = useRef(0);

  // ── Nach außen exponierte Kamera-Schnittstelle (Save/Load) ───────────
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  useImperativeHandle(ref, () => ({
    getCameraSnapshot: () => ({ ...cameraRef.current }),
    setCameraSnapshot: (cam: Camera) => {
      cameraRef.current = { ...cam };
      dirtyRef.current  = true;
    },
    getLastPointerCell: () => {
      const p = lastPointerClientRef.current;
      const c = canvasRef.current;
      if (!p || !c) return null;
      return getCellAt(p.x, p.y, c, cameraRef.current);
    },
    getViewportCenterCell: () => {
      const c = canvasRef.current;
      if (!c) return [0, 0];
      const rect = c.getBoundingClientRect();
      return getCellAt(rect.left + rect.width / 2, rect.top + rect.height / 2, c, cameraRef.current);
    },
  }), []);

  // ── Grid aus Zustand (nur für Platzieren/Löschen nötig) ───────────────
  const grid         = useGridStore(s => s.grid);
  const setCell      = useGridStore(s => s.setCell);
  const delCell      = useGridStore(s => s.deleteCell);
  const toggleForced = useGridStore(s => s.toggleForced);
  const pushUndo     = useGridStore(s => s.pushUndo);
  const beginBatch   = useGridStore(s => s.beginBatch);
  const endBatch     = useGridStore(s => s.endBatch);
  const gridRef      = useRef(grid);
  gridRef.current    = grid; // immer aktuell für Event-Handler

  // ── Werkzeug ──────────────────────────────────────────────────────────
  const tool      = useUIStore(s => s.tool);
  const toolRef   = useRef<Tool | null>(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // ── Selektion (State Machine, siehe canvas/selection.ts) ──────────────
  const selection            = useSelectionStore(s => s.selection);
  const resolvePointerDown   = useSelectionStore(s => s.resolvePointerDown);
  const updateMarquee        = useSelectionStore(s => s.updateMarquee);
  const finishMarquee        = useSelectionStore(s => s.finishMarquee);
  const clearSelection       = useSelectionStore(s => s.clearSelection);
  const beginFloatingDrag    = useSelectionStore(s => s.beginFloatingDrag);
  const updateFloatingDrag   = useSelectionStore(s => s.updateFloatingDrag);
  const interruptInteraction = useSelectionStore(s => s.interruptInteraction);
  const selectionRef         = useRef<SelectionState>(selection);
  selectionRef.current       = selection; // immer aktuell fürs Zeichnen

  // ── Zeichnen ──────────────────────────────────────────────────────────
  // Liest ausschließlich aus Refs — kein React-Kontext nötig.
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gridRef.current, cameraRef.current, c.clientWidth, c.clientHeight);
    renderSelectionOverlay(ctx, selectionRef.current, cameraRef.current);
  }, []); // keine Deps — liest aus stabilen Refs

  // ── rAF-Loop ──────────────────────────────────────────────────────────
  // Zeichnet nur wenn dirty, entkoppelt Drawing von React-Render-Zyklen.
  // Pan/Zoom: dirty=true → nächster Frame → draw. Kein Zustand, kein Re-Render.
  useEffect(() => {
    dirtyRef.current = true;
    const loop = () => {
      if (dirtyRef.current) { draw(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Grid-Änderung (Zustand) → dirty markieren → rAF zeichnet nächsten Frame
  useEffect(() => { dirtyRef.current = true; }, [grid]);
  // Selektions-Änderung (Marquee-Vorschau, Drehen/Spiegeln/Verschieben,
  // Commit/Cancel, …) → ebenfalls dirty
  useEffect(() => { dirtyRef.current = true; }, [selection]);

  // ── HiDPI-Resize ──────────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width  = c.clientWidth  * dpr;
      c.height = c.clientHeight * dpr;
      dirtyRef.current = true;
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // ── PointerController einrichten ──────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current!;

    const ctrl = new PointerController(
      c,
      {
        onPlace: (cx, cy, isDrag) => {
          const t  = toolRef.current;
          const g  = gridRef.current;
          const k  = `${cx},${cy}`;

          // Wird bei tool='select' oder tool=null nie aufgerufen (der
          // select-Zweig ruft nie onPlace/onDelete auf, und bei null greift
          // shouldPan() in pointerDown zuerst — alles pannt statt zu platzieren),
          // aber TS kennt diese Laufzeit-Garantien nicht — Guards nötig für Typsicherheit.
          if (t === 'select' || t === null) return;
          if (t === 'delete') { delCell(cx, cy); return; }

          if (!g.has(k)) {
            setCell(cx, cy, t);
          } else if (!isDrag) {
            const cell = g.get(k)!;
            if (cell.type === t) {
              // Gleicher Typ + Tap → Forced togglen (⊕ an/aus)
              toggleForced(cx, cy);
            } else {
              // Anderer Typ → Typ wechseln, Force zurücksetzen
              setCell(cx, cy, t, cell.state);
            }
          }
        },

        onDelete: (cx, cy) => delCell(cx, cy),

        // Kamera direkt mutieren — kein Zustand, kein Re-Render
        onPan: (dx, dy) => {
          const cam = cameraRef.current;
          cam.x -= dx / cam.zoom;
          cam.y -= dy / cam.zoom;
          dirtyRef.current = true;
        },

        onZoom: (factor, focalSx, focalSy) => {
          zoomAtPoint(cameraRef.current, factor, focalSx, focalSy);
          dirtyRef.current = true;
        },

        // Ein ganzer Drag (Bresenham über viele Zellen) soll EIN
        // Undo-Schritt sein, nicht einer pro Zelle. Deshalb hier einmalig
        // vor dem ersten Platzieren/Löschen pushUndo(), danach beginBatch()
        // — setCell/deleteCell/toggleForced überspringen pushUndo dann bis
        // endBatch() beim Loslassen. Betrifft nur Platzieren/Löschen — die
        // Selektion braucht das nicht (siehe gridStore.ts batchActive-Doku).
        onDragStart: () => {
          pushUndo();
          beginBatch();
        },

        onDragEnd: () => {
          endBatch();
        },

        // ─── Selektions-Werkzeug ──────────────────────────────────────
        onSelectRect: (x0, y0, x1, y1) => {
          finishMarquee({ x: x0, y: y0 }, { x: x1, y: y1 });
        },

        onSelectRectPreview: (x0, y0, x1, y1) => {
          updateMarquee({ x: x0, y: y0 }, { x: x1, y: y1 });
        },

        onSelectClear: () => {
          clearSelection();
        },

        onSelectDragStart: () => {
          beginFloatingDrag();
        },

        onSelectDragStep: (dx, dy) => {
          updateFloatingDrag(dx, dy);
        },

        onSelectDragEnd: () => {
          // Bewusst kein Commit hier — siehe onSelectDragEnd-Doku in
          // canvas/input.ts. Nichts weiter zu tun.
        },

        onSelectCancel: () => {
          interruptInteraction();
        },
      },
      () => cameraRef.current,
      () => toolRef.current,
      // Siehe getSelectionHit-Doku im PointerController-Konstruktor: hat
      // Nebenwirkungen (Commit/Anheben), ist kein reiner Hit-Test mehr.
      (cx, cy) => resolvePointerDown({ x: cx, y: cy }),
    );

    ctrlRef.current = ctrl;

    const onWheel = (e: WheelEvent) => { e.preventDefault(); ctrl.wheel(e); };
    c.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      c.removeEventListener('wheel', onWheel);
      ctrlRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stabil — Callbacks schließen über Refs

  // ── Pointer-Events ───────────────────────────────────────────────────
  const fwd = (fn: (e: PointerEvent) => void) =>
    (e: React.PointerEvent<HTMLCanvasElement>) => fn(e.nativeEvent);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: tool === null ? 'grab' : 'crosshair' }}
      onPointerDown={fwd(e => {
        lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
        ctrlRef.current?.pointerDown(e);
      })}
      onPointerMove={fwd(e => {
        lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
        ctrlRef.current?.pointerMove(e);
      })}
      onPointerUp={fwd(e    => ctrlRef.current?.pointerUp(e))}
      onPointerCancel={fwd(e => ctrlRef.current?.pointerCancel(e))}
      onContextMenu={e => e.preventDefault()}
    />
  );
});

Canvas.displayName = 'Canvas';
