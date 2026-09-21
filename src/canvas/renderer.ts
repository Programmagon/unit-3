import type { Grid, CellType } from '../simulation/types';
import { fromKey } from '../simulation/grid';
import { type Camera, worldToScreen } from './coordinates';
import type { SelectionState } from './selection';

export type { Camera };

const CELL_COLORS: Record<string, { on: string; off: string; glow: string }> = {
  cable:    { on: '#00ff88', off: '#0b2e1a', glow: 'rgba(0,255,136,.35)'  },
  inverter: { on: '#ff9900', off: '#2a1500', glow: 'rgba(255,153,0,.35)'  },
  delay:    { on: '#bb44ff', off: '#1d0035', glow: 'rgba(187,68,255,.35)' },
};
const CELL_ICONS: Record<string, string> = { cable: '━', inverter: '◇', delay: '▷' };

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
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
 * Zeichnet eine einzelne Zelle (Körper + Icon + Forced-Badge) an einer
 * Bildschirmposition. Genutzt von renderFrame (normale Grid-Zellen) UND
 * renderSelectionOverlay (Buffer-Zellen einer schwebenden Selektion).
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  type: CellType, state: boolean, forced: boolean | undefined,
  sx: number, sy: number, z: number,
): void {
  const c  = CELL_COLORS[type];
  const p  = Math.max(1.5, z * .07);
  const rw = z - p * 2, rh = z - p * 2;
  const r  = Math.min(4, rw * .2);

  if (state && z >= 10) {
    ctx.shadowColor = c.glow;
    ctx.shadowBlur  = forced ? z * 1.0 : z * .6;
  }

  ctx.fillStyle = state ? c.on : c.off;
  drawRoundedRect(ctx, sx + p, sy + p, rw, rh, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (z >= 20) {
    ctx.fillStyle    = state ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.12)';
    ctx.font         = `${Math.min(z * .38, 16)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CELL_ICONS[type], sx + z / 2, sy + z / 2);
  }

  if (forced && z >= 12) {
    drawForcedBadge(ctx, sx, sy, z);
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
  const z = cam.zoom;
  ctx.fillStyle = '#0b0b1e';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#13133a'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = Math.floor(cam.x); gx <= cam.x + width / z + 1; gx++) {
    const [sx] = worldToScreen(gx, 0, cam);
    ctx.moveTo(sx + .5, 0); ctx.lineTo(sx + .5, height);
  }
  for (let gy = Math.floor(cam.y); gy <= cam.y + height / z + 1; gy++) {
    const [, sy] = worldToScreen(0, gy, cam);
    ctx.moveTo(0, sy + .5); ctx.lineTo(width, sy + .5);
  }
  ctx.stroke();

  for (const [k, cell] of grid) {
    const [cx, cy] = fromKey(k);
    const [sx, sy] = worldToScreen(cx, cy, cam);
    drawCell(ctx, cell.type, cell.state, cell.forced, sx, sy, z);
  }
}

function strokeRectAt(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, w: number, h: number, dashed: boolean): void {
  const z = cam.zoom;
  const [sx, sy] = worldToScreen(x, y, cam);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
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
 */
export function renderSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selection: SelectionState,
  cam: Camera,
): void {
  const z = cam.zoom;

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
    for (const c of buffer) {
      const [sx, sy] = worldToScreen(rect.x + c.dx, rect.y + c.dy, cam);
      drawCell(ctx, c.type, c.state, c.forced, sx, sy, z);
    }
    strokeRectAt(ctx, cam, rect.x, rect.y, rect.width, rect.height, false);
  }
}
