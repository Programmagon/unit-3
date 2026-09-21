import { forwardRef, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { useGridStore }      from '../store/gridStore';
import { useUIStore }        from '../store/uiStore';
import { useSelectionStore } from '../store/selectionStore';
import { renderFrame, renderSelectionOverlay } from '../canvas/renderer';
import { PointerController } from '../canvas/input';
import { zoomAtPoint, getCellAt } from '../canvas/coordinates';
import type { Camera }       from '../canvas/coordinates';
import type { Tool }         from '../canvas/input';
import { cellsInRect } from '../canvas/selection';
import { finalizePendingMove } from '../store/selectionOps';

// Kamera-Startwert — lebt als Ref, kein Zustand, keine React-Re-Renders
const INITIAL_CAMERA: Camera = { x: -15, y: -9, zoom: 36 };

/**
 * Von außen (App.tsx / SimBar) erreichbare Kamera-Schnittstelle.
 * Nötig, weil die Kamera bewusst NICHT im Store lebt (siehe cameraRef unten) —
 * Save/Load braucht trotzdem Lese-/Schreibzugriff für Schritt 4.
 */
export interface CanvasHandle {
  getCameraSnapshot: () => Camera;
  setCameraSnapshot: (cam: Camera) => void;
  /**
   * Letzte bekannte Pointer-Zellposition — null falls noch nie ein Pointer-
   * Event stattfand. Nicht Teil des Save/Load-Kontrakts (Schritt 4), sondern
   * neu für Schritt 5: Strg+V soll "an letzter bekannter Zeigerposition"
   * einfügen, aber useKeyboardShortcuts.ts hat keinen eigenen Zugriff auf
   * Pointer-Position oder Kamera (beide leben nur hier in Canvas.tsx-Refs).
   */
  getLastPointerCell: () => [number, number] | null;
  /**
   * Zell-Position in der Mitte des aktuell sichtbaren Canvas-Ausschnitts.
   * Neu für Schritt 5b, Punkt 3: der Einfügen-BUTTON (im Unterschied zu
   * Strg+V, das die Mausposition sinnvoll nutzen kann) hat auf Touch-
   * Geräten kein Äquivalent zu einer "Zeigerposition" — dort ist die
   * Bildschirmmitte der einzige vorhersagbare, immer sichtbare Ankerpunkt.
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
      // getCellAt erwartet Client-Koordinaten (wie e.clientX/Y) und rechnet
      // intern über getBoundingClientRect() in Canvas-relative Koordinaten
      // um — deshalb hier die Mitte des Bounding Rects, nicht clientWidth/2.
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

  // ── Selektion ─────────────────────────────────────────────────────────
  const selected      = useSelectionStore(s => s.selected);
  const setSelection  = useSelectionStore(s => s.setSelection);
  const clearSelection = useSelectionStore(s => s.clearSelection);
  const selectedRef   = useRef(selected);
  selectedRef.current = selected; // immer aktuell für Event-Handler
  // Angesammelte, noch nicht ins Grid geschriebene Verschiebung (Schritt 5b,
  // "Schwebende Verschiebung"). Reaktiv abonniert wie selected/tool.
  const pendingOffset    = useSelectionStore(s => s.pendingOffset);
  const setPendingOffset = useSelectionStore(s => s.setPendingOffset);
  const pendingOffsetRef = useRef(pendingOffset);
  pendingOffsetRef.current = pendingOffset;
  /**
   * Live-Vorschau beim Verschieben — rein visuell, kein Store-Update pro
   * pointermove. Enthält NUR das Delta des AKTUELL laufenden Drags, nicht
   * die gesamte angesammelte (pending) Verschiebung.
   */
  const previewOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  /** Live-Vorschau beim Aufziehen eines neuen Rechtecks — ebenfalls rein visuell. */
  const activeDragRectRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // ── Zeichnen ──────────────────────────────────────────────────────────
  // Liest ausschließlich aus Refs — kein React-Kontext nötig.
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame(ctx, gridRef.current, cameraRef.current, c.clientWidth, c.clientHeight, selectedRef.current);
    const totalOffset = {
      dx: pendingOffsetRef.current.dx + (previewOffsetRef.current?.dx ?? 0),
      dy: pendingOffsetRef.current.dy + (previewOffsetRef.current?.dy ?? 0),
    };
    renderSelectionOverlay(
      ctx, gridRef.current, selectedRef.current, cameraRef.current,
      totalOffset, activeDragRectRef.current,
    );
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
  // Selektions-Änderung (z. B. Esc, SelectionActions-Buttons) → ebenfalls dirty
  useEffect(() => { dirtyRef.current = true; }, [selected]);
  useEffect(() => { dirtyRef.current = true; }, [pendingOffset]);

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
        // endBatch() beim Loslassen.
        onDragStart: () => {
          pushUndo();
          beginBatch();
        },

        onDragEnd: () => {
          endBatch();
        },

        // ─── Selektions-Werkzeug (Schritt 5 / 5b) ────────────────────
        onSelectRect: (x0, y0, x1, y1, modifier) => {
          const rectKeys = cellsInRect(x0, y0, x1, y1);
          const g = gridRef.current;
          const hit = new Set<string>();
          for (const k of rectKeys) if (g.has(k)) hit.add(k);

          const current = selectedRef.current;
          if (modifier === 'add') {
            setSelection(new Set([...current, ...hit]));
          } else if (modifier === 'subtract') {
            setSelection(new Set([...current].filter(k => !hit.has(k))));
          } else {
            setSelection(hit);
          }
          activeDragRectRef.current = null;
          dirtyRef.current = true;
        },

        onSelectRectPreview: (x0, y0, x1, y1) => {
          activeDragRectRef.current = { x0, y0, x1, y1 };
          dirtyRef.current = true;
        },

        onSelectClear: () => {
          finalizePendingMove();
          clearSelection();
          dirtyRef.current = true;
        },

        onSelectMovePreview: (dx, dy) => {
          previewOffsetRef.current = { dx, dy }; // Delta NUR des laufenden Drags
          dirtyRef.current = true;
        },

        // Schreibt NICHT mehr direkt ins Grid — sammelt stattdessen im
        // schwebenden pendingOffset an. Erst finalizePendingMove() (bei der
        // nächsten "genuinen" Selektions-Aktion) schreibt final ins Grid.
        onSelectMoveCommit: (dx, dy) => {
          setPendingOffset({
            dx: pendingOffsetRef.current.dx + dx,
            dy: pendingOffsetRef.current.dy + dy,
          });
          previewOffsetRef.current = null;
          dirtyRef.current = true;
        },

        onSelectFinalize: () => {
          finalizePendingMove();
          dirtyRef.current = true;
        },

        onSelectCancel: () => {
          previewOffsetRef.current = null;
          activeDragRectRef.current = null;
          dirtyRef.current = true;
        },
      },
      () => cameraRef.current,
      () => toolRef.current,
      // Hit-Test gegen die AKTUELLE sichtbare (ggf. schwebende) Position —
      // nicht gegen die rohen Original-Keys.
      (cx, cy) => {
        const off = pendingOffsetRef.current;
        return selectedRef.current.has(`${cx - off.dx},${cy - off.dy}`);
      },
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
