import type { Grid, CellType } from '../simulation/types';
import { fromKey, key } from '../simulation/grid';
import { type Camera, worldToScreen } from './coordinates';

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

/** Kleiner Pfeil-nach-oben als "forced"-Markierung (oben rechts in der Zelle) */
function drawForcedBadge(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, z: number,
): void {
  const r   = Math.max(3, z * 0.11);  // Radius des Kreises
  const cx  = sx + z - r * 1.4;
  const cy  = sy +     r * 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur  = 0;
  ctx.fill();
  // Kleines + im Kreis
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
 * Bildschirmposition. Extrahiert aus der ursprünglichen renderFrame-Schleife
 * (Schritt 5b) — 1:1 dieselbe Zeichen-Logik, keine Verhaltensänderung.
 * Wird jetzt von ZWEI Stellen genutzt: renderFrame (normale Zellen) und
 * renderSelectionOverlay (selektierte Zellen an ggf. verschobener Position).
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

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  grid: Grid, cam: Camera,
  width: number, height: number,
  /**
   * Keys, die HIER übersprungen werden (werden stattdessen von
   * renderSelectionOverlay an ihrer — ggf. verschobenen — Position
   * gezeichnet). Optional, damit renderFrame ohne Selektionskontext
   * (z. B. in Tests) weiterhin exakt wie vorher funktioniert.
   */
  hiddenKeys?: Set<string>,
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
    if (hiddenKeys?.has(k)) continue; // wird von renderSelectionOverlay gezeichnet
    const [cx, cy] = fromKey(k);
    const [sx, sy] = worldToScreen(cx, cy, cam);
    drawCell(ctx, cell.type, cell.state, cell.forced, sx, sy, z);
  }
}

/**
 * Zeichnet die selektierten Zellen SEPARAT von renderFrame, mit ihrem
 * ECHTEN Aussehen (Farbe, Icon, Forced-Badge) an ihrer (ggf. schwebend
 * verschobenen) Position — plus einen dünnen Rahmen zur Kennzeichnung.
 * Läuft IMMER so (auch wenn offset={0,0} — kein bedingter Sonderfall).
 *
 * Kollisionswarnung: Während eines aktiven Verschiebens (offset != {0,0})
 * überschreibt ein Ablegen auf einer bereits belegten, NICHT selektierten
 * Zelle diese beim Commit kommentarlos (siehe remapCells in gridStore.ts —
 * bewusste, aber für den Nutzer sonst unsichtbare Kollisions-Policy). Ohne
 * visuelles Feedback bemerkt man den Datenverlust erst nach dem Loslassen.
 * Betroffene Zellen bekommen daher einen roten statt weißen Rahmen, solange
 * die Verschiebung noch schwebt (rein visuell, keine Store-Mutation).
 */
export function renderSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  selected: Set<string>,
  cam: Camera,
  offset: { dx: number; dy: number },
  activeDragRect: { x0: number; y0: number; x1: number; y1: number } | null,
): void {
  const z = cam.zoom;
  const isMoving = offset.dx !== 0 || offset.dy !== 0;

  for (const k of selected) {
    const cell = grid.get(k);
    if (!cell) continue;
    const [cx, cy] = fromKey(k);
    const nx = cx + offset.dx, ny = cy + offset.dy;
    const targetKey = key(nx, ny);
    // Nur während des Verschiebens relevant — bei offset={0,0} deckt sich
    // targetKey immer mit der eigenen (selektierten) Originalposition.
    const collides = isMoving && grid.has(targetKey) && !selected.has(targetKey);
    const [sx, sy] = worldToScreen(nx, ny, cam);
    drawCell(ctx, cell.type, cell.state, cell.forced, sx, sy, z);
    ctx.strokeStyle = collides ? 'rgba(255,68,85,.9)' : 'rgba(255,255,255,.7)';
    ctx.lineWidth = collides ? 2 : 1.5;
    ctx.strokeRect(sx + .5, sy + .5, z - 1, z - 1);
  }

  if (activeDragRect) {
    const { x0, y0, x1, y1 } = activeDragRect;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const [sx, sy] = worldToScreen(minX, minY, cam);
    const w = (maxX - minX + 1) * z;
    const h = (maxY - minY + 1) * z;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sx + .5, sy + .5, w - 1, h - 1);
    ctx.restore();
  }
}
