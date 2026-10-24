import type { Grid, CellType } from '../simulation/types';
import { fromKey, key } from '../simulation/grid';
import { type Camera, worldToScreen } from './coordinates';
import type { SelectionState } from './selection';
import { CELL_STYLE, getCellPalette, paletteFor, type CellStyle, type Palette } from './cellStyle';

export type { Camera };

/** Symbole als Linienpfade in einem 24×24-Raster (wie im Render-Labor) */
const GLYPH_PATHS: Record<CellType, Path2D> = {
  cable:    new Path2D('M4 12h16'),
  inverter: new Path2D('M12 4l8 8-8 8-8-8z'),
  delay:    new Path2D('M8 5l11 7-11 7z'),
};

interface DrawableCell {
  x: number; y: number;
  type: CellType; state: boolean; forced?: boolean;
}
/** Typ der Zelle an dieser Weltposition (undefined = leer) — für Verschmelzen und Konturen */
type TypeAt = (x: number, y: number) => CellType | undefined;

/** Rechteck mit je Ecke eigenem Radius k = [oben-links, oben-rechts, unten-rechts, unten-links] */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  l: number, t: number, r: number, b: number, k: number[],
): void {
  const m = Math.min((r - l) / 2, (b - t) / 2);
  const R = k.map(q => Math.max(0, Math.min(q, m)));
  ctx.beginPath();
  ctx.moveTo(l + R[0], t);
  ctx.lineTo(r - R[1], t);  ctx.arcTo(r, t, r, t + R[1], R[1]);
  ctx.lineTo(r, b - R[2]);  ctx.arcTo(r, b, r - R[2], b, R[2]);
  ctx.lineTo(l + R[3], b);  ctx.arcTo(l, b, l, b - R[3], R[3]);
  ctx.lineTo(l, t + R[0]);  ctx.arcTo(l, t, l + R[0], t, R[0]);
  ctx.closePath();
}

/** Kleiner Kreis mit "+" als "forced"-Markierung (oben rechts in der Zelle) */
function drawForcedBadge(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, z: number,
): void {
  const r   = Math.max(3, z * 0.11);
  const cx  = sx + z - r * 1.4;
  const cy  = sy +     r * 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur  = 0;
  ctx.fill();
  const arm = r * 0.5;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = Math.max(1, r * 0.35);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
  ctx.stroke();
}

/**
 * Zeichnet eine Menge von Zellen in Form und Farbe von CELL_STYLE
 * (siehe cellStyle.ts). Genutzt von renderFrame (Grid-Zellen) UND
 * renderSelectionOverlay (Buffer-Zellen einer schwebenden Selektion).
 *
 * Verschmelzen und Eckenrundung hängen von den Nachbarn ab, deshalb braucht
 * die Funktion `typeAt`. Umkehrer und Verzögerer bekommen ihre Kontur auch an
 * Seiten, die an einen anderen Typ grenzen (z. B. ein Kabel); Kabel selbst
 * nicht — an so einer Grenze steht genau eine Linie. Gezeichnet wird in Durchgängen: Körper (mit Leuchten und
 * Kontur), Fugen, Symbole, Forced-Markierung — so überdeckt keine Nachbarzelle
 * ein Symbol oder eine Fuge.
 *
 * viewW/viewH dienen nur dem Weglassen unsichtbarer Zellen.
 */
function drawCells(
  ctx: CanvasRenderingContext2D,
  cells: DrawableCell[], typeAt: TypeAt, cam: Camera,
  viewW: number, viewH: number,
  /** Stil und Palette; Standard ist der laufende Canvas, die Look-Vorschau übergibt eigene. */
  s: Readonly<CellStyle> = CELL_STYLE,
  pal: Palette = getCellPalette(),
): void {
  const has = (x: number, y: number) => typeAt(x, y) !== undefined;
  const z   = cam.zoom;
  const dpr = ctx.getTransform().a || 1;
  const sn  = (v: number) => Math.round(v * dpr) / dpr;
  const join = s.connect !== 'off';
  const p    = sn(s.pad * z);
  const rad  = s.round * z;

  // Bildschirmrechteck einer Zelle auf Geräte-Pixel gerundet. Beide Kanten
  // kommen aus derselben Rechnung wie bei der Nachbarzelle, damit verschmolzene
  // Zellen ohne Haarlinie aneinanderstoßen.
  const box = (x: number, y: number): [number, number, number, number] => {
    const [l, t] = worldToScreen(x,     y,     cam);
    const [r, b] = worldToScreen(x + 1, y + 1, cam);
    return [sn(l), sn(t), sn(r), sn(b)];
  };
  const visible = (L: number, T: number, R: number, B: number) =>
    R >= 0 && B >= 0 && L <= viewW && T <= viewH;

  // ── 1. Körper (Leuchten, Füllung, Kontur) ───────────────────────────
  for (const q of cells) {
    const [L, T, R, B] = box(q.x, q.y);
    if (!visible(L, T, R, B)) continue;

    const N  = join && has(q.x,     q.y - 1);
    const E  = join && has(q.x + 1, q.y);
    const S  = join && has(q.x,     q.y + 1);
    const Wd = join && has(q.x - 1, q.y);
    const l = L + (Wd ? 0 : p), t = T + (N ? 0 : p);
    const r = R - (E  ? 0 : p), b = B - (S ? 0 : p);

    // Ecke wird nur gerundet, wenn sie frei liegt (oder bei roundMode "cell" immer)
    const free = (a: boolean, c: boolean) => s.roundMode === 'cell' || !join ? true : (!a && !c);
    const k = [free(N, Wd), free(N, E), free(S, E), free(S, Wd)].map(f => f ? rad : 0);

    const onCol = pal.on[q.type];
    const fill  = q.state ? onCol : pal.off[q.type];

    if (q.state && s.glow && pal.glow > 0 && z >= 10) {
      ctx.save();
      ctx.shadowColor = onCol;
      ctx.shadowBlur  = z * (q.forced ? 0.75 : 0.45);
      ctx.globalAlpha = pal.glow;
      roundedPath(ctx, l, t, r, b, k);
      ctx.fillStyle = onCol;
      ctx.fill();
      ctx.restore();
    }

    const e = Math.min(s.edge, z / 4);
    if (e > 0) {
      roundedPath(ctx, l, t, r, b, k);
      ctx.fillStyle = q.state ? pal.edge[q.type] : pal.offLine[q.type];
      ctx.fill();
      // Kontur an freien Seiten und (nur Umkehrer/Verzögerer) an Seiten zu einem anderen Typ;
      // an Seiten zu gleichem Typ bleibt die Füllung bis zur Kante (verschmolzen)
      const line = (nx: number, ny: number, merged: boolean) =>
        !merged || (q.type !== 'cable' && typeAt(nx, ny) !== q.type);
      roundedPath(
        ctx,
        l + (line(q.x - 1, q.y, Wd) ? e : 0), t + (line(q.x, q.y - 1, N) ? e : 0),
        r - (line(q.x + 1, q.y, E) ? e : 0),   b - (line(q.x, q.y + 1, S) ? e : 0),
        k.map(v => Math.max(0, v - e)),
      );
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      roundedPath(ctx, l, t, r, b, k);
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  // ── 2. Fugen zwischen verschmolzenen Zellen (nur connect = "seam") ──
  if (s.connect === 'seam' && s.seamW > 0) {
    ctx.save();
    ctx.strokeStyle = pal.bg;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth   = s.seamW;
    for (const q of cells) {
      const [L, T, R, B] = box(q.x, q.y);
      if (!visible(L, T, R, B)) continue;
      const N  = has(q.x,     q.y - 1);
      const Wd = has(q.x - 1, q.y);
      const S  = has(q.x,     q.y + 1);
      const E  = has(q.x + 1, q.y);
      if (E) {
        const a  = T + (N && has(q.x + 1, q.y - 1) ? 0 : p);
        const b2 = B - (S && has(q.x + 1, q.y + 1) ? 0 : p);
        ctx.beginPath(); ctx.moveTo(R, a); ctx.lineTo(R, b2); ctx.stroke();
      }
      if (S) {
        const a  = L + (Wd && has(q.x - 1, q.y + 1) ? 0 : p);
        const b2 = R - (E  && has(q.x + 1, q.y + 1) ? 0 : p);
        ctx.beginPath(); ctx.moveTo(a, B); ctx.lineTo(b2, B); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── 3. Symbole ──────────────────────────────────────────────────────
  if (s.glyph !== 'none' && z >= 14) {
    for (const q of cells) {
      if (s.glyph === 'sel' && q.type === 'cable') continue;
      const [cx, cy] = worldToScreen(q.x + 0.5, q.y + 0.5, cam);
      if (cx < -z || cy < -z || cx > viewW + z || cy > viewH + z) continue;

      const col = q.state ? pal.glyphOn : pal.offLine[q.type];
      ctx.save();
      if (s.glyph === 'dot') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, z * 0.09 * (s.glyphSize / 0.55)), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const k = z * s.glyphSize / 24;
        ctx.translate(cx - 12 * k, cy - 12 * k);
        ctx.scale(k, k);
        ctx.strokeStyle = col;
        ctx.lineWidth   = Math.max(1.2, z * 0.06) / k;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke(GLYPH_PATHS[q.type]);
      }
      ctx.restore();
    }
  }

  // ── 4. Forced-Markierung ────────────────────────────────────────────
  if (z >= 12) {
    for (const q of cells) {
      if (!q.forced) continue;
      const [L, T, R, B] = box(q.x, q.y);
      if (!visible(L, T, R, B)) continue;
      drawForcedBadge(ctx, L, T, z);
    }
  }
}

/**
 * Zeichnet das komplette Grid. Kein Sonderfall für Selektion mehr nötig —
 * `grid` ist zu jedem Zeitpunkt der tatsächliche, sichtbare Zustand (auch
 * während eine Selektion schwebt: deren Quelle wurde beim Anheben bereits
 * geleert, siehe selectionStore.ts ensureFloating). Es gibt keine separate
 * "eigentlich woanders, aber visuell hier"-Position mehr zu überspringen.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  grid: Grid, cam: Camera,
  width: number, height: number,
): void {
  const z   = cam.zoom;
  const pal = getCellPalette();
  const dpr = ctx.getTransform().a || 1;

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  // Raster: Haarlinie von genau einem Geräte-Pixel, mittig im Pixel (scharf),
  // jede 8. Linie betont. Bei sehr kleinem Zoom entfällt es (zu dicht).
  if (CELL_STYLE.grid && z >= 10) {
    const px    = (v: number) => Math.round(v * dpr) / dpr + 0.5 / dpr;
    const minor = new Path2D();
    const major = new Path2D();
    for (let gx = Math.floor(cam.x); gx <= cam.x + width / z + 1; gx++) {
      const [sx] = worldToScreen(gx, 0, cam);
      const target = gx % 8 === 0 ? major : minor;
      target.moveTo(px(sx), 0); target.lineTo(px(sx), height);
    }
    for (let gy = Math.floor(cam.y); gy <= cam.y + height / z + 1; gy++) {
      const [, sy] = worldToScreen(0, gy, cam);
      const target = gy % 8 === 0 ? major : minor;
      target.moveTo(0, px(sy)); target.lineTo(width, px(sy));
    }
    ctx.lineWidth = 1 / dpr;
    ctx.strokeStyle = pal.grid;      ctx.stroke(minor);
    ctx.strokeStyle = pal.gridMajor; ctx.stroke(major);
  }

  const cells: DrawableCell[] = [];
  for (const [k, cell] of grid) {
    const [x, y] = fromKey(k);
    cells.push({ x, y, type: cell.type, state: cell.state, forced: cell.forced });
  }
  drawCells(ctx, cells, (x, y) => grid.get(key(x, y))?.type, cam, width, height);
}

function strokeRectAt(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, w: number, h: number, dashed: boolean): void {
  const z = cam.zoom;
  const [sx, sy] = worldToScreen(x, y, cam);
  ctx.save();
  ctx.strokeStyle = getCellPalette().selection;
  ctx.lineWidth = dashed ? 1.5 : 2;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.strokeRect(sx + .5, sy + .5, w * z - 1, h * z - 1);
  ctx.restore();
}

/**
 * Zeichnet den Selektions-Zustand: Marquee-Vorschau und "selected" nur als
 * gestrichelter Rahmen (der Inhalt liegt unverändert im Grid, renderFrame
 * hat ihn bereits korrekt gezeichnet) — "floating" zusätzlich mit den
 * tatsächlichen Buffer-Zellen (durchgezogener Rahmen: hier ist etwas aktiv
 * aufgehoben, im Unterschied zu einer nur markierten Fläche).
 *
 * Leere Stellen im (sparse) Buffer werden bewusst NICHT übermalt — dort
 * scheint einfach das durch, was renderFrame an dieser Bildschirmposition
 * bereits gezeichnet hat (siehe stampBuffer-Doku in canvas/selection.ts:
 * exakt das Verhalten, das beim Commit tatsächlich passieren würde).
 * Die Buffer-Zellen verschmelzen nur untereinander, nicht mit dem Grid darunter.
 */
export function renderSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selection: SelectionState,
  cam: Camera,
): void {
  if (selection.status === 'marquee') {
    const x0 = Math.min(selection.start.x, selection.current.x);
    const y0 = Math.min(selection.start.y, selection.current.y);
    const w  = Math.abs(selection.current.x - selection.start.x) + 1;
    const h  = Math.abs(selection.current.y - selection.start.y) + 1;
    strokeRectAt(ctx, cam, x0, y0, w, h, true);
    return;
  }

  if (selection.status === 'selected') {
    strokeRectAt(ctx, cam, selection.rect.x, selection.rect.y, selection.rect.width, selection.rect.height, true);
    return;
  }

  if (selection.status === 'floating') {
    const { rect, buffer } = selection;
    const cells: DrawableCell[] = buffer.map(c => ({
      x: rect.x + c.dx, y: rect.y + c.dy,
      type: c.type, state: c.state, forced: c.forced,
    }));
    const occupied = new Map<string, CellType>(cells.map(c => [key(c.x, c.y), c.type] as [string, CellType]));
    // Schwebende Zellen sind höchstens so viele wie die Selektion — kein Culling nötig
    drawCells(ctx, cells, (x, y) => occupied.get(key(x, y)), cam, Infinity, Infinity);
    strokeRectAt(ctx, cam, rect.x, rect.y, rect.width, rect.height, false);
  }
}


/** Kleine Beispielszene für die Look-Vorschau im Menü: 5 × 3 Zellen, ein und aus gemischt. */
const PREVIEW_SCENE: DrawableCell[] = (() => {
  const rows: [CellType, boolean][][] = [
    [['cable', true],  ['cable', true],  ['cable', true],  ['inverter', true],  ['delay', true]],
    [['cable', false], ['cable', false], ['cable', false], ['inverter', false], ['delay', false]],
    [['cable', true],  ['inverter', false], ['delay', true], ['delay', false],  ['cable', false]],
  ];
  return rows.flatMap((r, y) => r.map(([type, state], x) => ({ x, y, type, state })));
})();
export const PREVIEW_COLS = 5;
export const PREVIEW_ROWS = 3;

/** Zeichnet die Beispielszene mit einem beliebigen Stil. `zoom` = Zellgröße in px. */
export function renderLookPreview(
  ctx: CanvasRenderingContext2D, style: Readonly<CellStyle>, zoom: number,
): void {
  const pal = paletteFor(style);
  const w = PREVIEW_COLS * zoom, h = PREVIEW_ROWS * zoom;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);
  const at: TypeAt = (x, y) => PREVIEW_SCENE.find(c => c.x === x && c.y === y)?.type;
  drawCells(ctx, PREVIEW_SCENE, at, { x: 0, y: 0, zoom }, w, h, style, pal);
}
