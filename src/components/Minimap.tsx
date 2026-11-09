import { useEffect, useRef, type RefObject } from 'react';
import { useGridStore } from '../store/gridStore';
import { useSettingsStore } from '../store/settingsStore';
import { getCellPalette } from '../canvas/cellStyle';
import { drawOverview } from '../canvas/renderer';
import type { Grid } from '../simulation/types';
import { useT } from '../i18n';
import type { CanvasHandle } from './Canvas';

const W = 168;
const H = 112;
const PAD = 2; // Zellen Rand um den Inhalt

interface Bounds { x0: number; y0: number; x1: number; y1: number }
const boundsCache = new WeakMap<Grid, Bounds>();
/** Umriss aller Zellen in Weltkoordinaten (x1/y1 exklusiv); je Grid-Objekt gemerkt. */
function boundsOf(grid: Grid): Bounds {
  let b = boundsCache.get(grid);
  if (b) return b;
  b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const k of grid.keys()) {
    const i = k.indexOf(',');
    const x = +k.slice(0, i), y = +k.slice(i + 1);
    if (x < b.x0) b.x0 = x;
    if (y < b.y0) b.y0 = y;
    if (x + 1 > b.x1) b.x1 = x + 1;
    if (y + 1 > b.y1) b.y1 = y + 1;
  }
  boundsCache.set(grid, b);
  return b;
}

interface Mapping { minX: number; minY: number; s: number; ox: number; oy: number }

/**
 * Minimap: Übersicht über alle Zellen plus der gerade sichtbare Ausschnitt.
 * Tippen oder Ziehen darin setzt die Bildmitte dorthin.
 *
 * Die Kamera lebt als Ref im Canvas (kein Store, keine Ereignisse), darum fragt
 * eine eigene rAF-Schleife den Stand ab und zeichnet nur, wenn sich Kamera,
 * Fenstergröße, Grid, Farben oder Einstellungen geändert haben. Der Kartenbereich
 * umfasst immer Zellen UND Ausschnitt — der Ausschnitt bleibt also auch dann
 * sichtbar, wenn man weit von den Zellen weggescrollt hat.
 */
export function Minimap({ canvas }: { canvas: RefObject<CanvasHandle | null> }) {
  const t = useT();
  const enabled = useSettingsStore(s => s.settings.minimap);
  const hasCells = useGridStore(s => s.grid.size > 0);
  const ref = useRef<HTMLCanvasElement>(null);
  const map = useRef<Mapping | null>(null);
  const dragging = useRef(false);
  const visible = enabled && hasCells;

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = '';
    let lastGrid: unknown = null;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = ref.current, h = canvas.current;
      if (!c || !h || c.offsetParent === null) return; // ausgeblendet (kleiner Bildschirm)
      const cam = h.getCameraSnapshot();
      const view = h.getViewSize();
      if (view.w === 0 || view.h === 0) return;
      const grid = useGridStore.getState().grid;
      const dpr = window.devicePixelRatio || 1;
      const sig = `${cam.x}|${cam.y}|${cam.zoom}|${view.w}|${view.h}|${dpr}|${document.documentElement.dataset.theme}|${useSettingsStore.getState().settings.look}|${useSettingsStore.getState().settings.offTone}`;
      if (sig === last && grid === lastGrid) return;
      last = sig; lastGrid = grid;

      const ctx = c.getContext('2d');
      if (!ctx) return;
      if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Kartenbereich: Zellen + sichtbarer Ausschnitt. Der Umriss der Zellen wird je Grid
      // einmal berechnet (bounds), nicht bei jeder Kamerabewegung.
      const bb = boundsOf(grid);
      const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + view.w / cam.zoom, vy1 = cam.y + view.h / cam.zoom;
      const minX = Math.min(vx0, bb.x0) - PAD, minY = Math.min(vy0, bb.y0) - PAD;
      const maxX = Math.max(vx1, bb.x1) + PAD, maxY = Math.max(vy1, bb.y1) + PAD;
      const ww = maxX - minX, wh = maxY - minY;
      const s = Math.min(W / ww, H / wh);
      const ox = (W - ww * s) / 2, oy = (H - wh * s) / 2;
      map.current = { minX, minY, s, ox, oy };

      const pal = getCellPalette();
      drawOverview(ctx, grid, minX, minY, s, ox, oy);

      // Sichtbarer Ausschnitt
      const rx = ox + (vx0 - minX) * s, ry = oy + (vy0 - minY) * s;
      const rw = (vx1 - vx0) * s, rh = (vy1 - vy0) * s;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pal.selection;
      ctx.fillStyle = pal.selection;
      ctx.globalAlpha = 0.14; // pal.selection ist rgba(): Deckkraft separat, nicht per Farbsuffix
      ctx.fillRect(rx, ry, rw, rh);
      ctx.globalAlpha = 1;
      ctx.strokeRect(rx + 0.75, ry + 0.75, Math.max(1, rw - 1.5), Math.max(1, rh - 1.5));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, canvas]);

  if (!visible) return null;

  const moveTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = map.current, h = canvas.current;
    if (!m || !h) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width);
    const py = (e.clientY - r.top) * (H / r.height);
    h.centerOn((px - m.ox) / m.s + m.minX, (py - m.oy) / m.s + m.minY);
  };

  return (
    <canvas
      ref={ref}
      className="minimap"
      role="img"
      aria-label={t('minimap.label')}
      style={{ width: W, height: H }}
      onPointerDown={e => {
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={e => { if (dragging.current) moveTo(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    />
  );
}
