/**
 * Reine Geometrie-Funktionen für Selektion (Schritt 5).
 * KEIN React-Import, KEIN Store-Import — operiert ausschließlich auf
 * Set<string> von Grid-Keys ("x,y"). Kennt weder Grid noch Cell-Daten;
 * das Filtern nach tatsächlich belegten Zellen passiert beim Aufrufer
 * (Canvas.tsx), der Zugriff auf das Grid hat.
 */
import { key, fromKey } from '../simulation/grid';

/** Alle Grid-Keys innerhalb eines Rechtecks (inklusive Rand, Reihenfolge der Ecken egal). */
export function cellsInRect(x0: number, y0: number, x1: number, y1: number): Set<string> {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const result = new Set<string>();
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      result.add(key(x, y));
    }
  }
  return result;
}

/** Bounding Box einer Key-Menge — Basis für Rotation/Spiegelung/Zentrum. Leeres Set → alle 0. */
export function boundingBox(keys: Set<string>): { minX: number; minY: number; maxX: number; maxY: number } {
  if (keys.size === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const [x, y] = fromKey(k);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Alle Keys um (dx,dy) verschoben. */
export function translateKeys(keys: Set<string>, dx: number, dy: number): Set<string> {
  const result = new Set<string>();
  for (const k of keys) {
    const [x, y] = fromKey(k);
    result.add(key(x + dx, y + dy));
  }
  return result;
}

/**
 * Rundet Halbe IMMER von Null weg (1.5→2 und -1.5→-2) — anders als
 * Math.round, das Halbe immer Richtung +Infinity rundet (1.5→2, ABER
 * -1.5→-1, nicht -2). Diese Asymmetrie war die Ursache des Rotations-Drifts,
 * siehe rotateKeys-Doku unten.
 */
function roundHalfAwayFromZero(n: number): number {
  return n >= 0 ? Math.round(n) : -Math.round(-n);
}

/**
 * 90°-Rotation um das Bounding-Box-Zentrum.
 * dir: 1 = im Uhrzeigersinn, -1 = gegen den Uhrzeigersinn.
 *
 * Nicht-quadratische Bounding Boxes: Breite/Höhe tauschen sich nach der
 * Rotation (z. B. 1x5-Linie → 5x1-Linie) — das ist korrekt und erwartet.
 *
 * BUGFIX (Drift): bei ungleicher Breite/Höhen-Parität (z. B. 5x2) braucht
 * die Platzierung des dimensionsvertauschten Rechtecks einen halben
 * Zellen-Versatz, der auf dem Integer-Grid nicht exakt darstellbar ist —
 * das allein ist unvermeidbar. Der eigentliche Bug lag in der Rundung:
 * Math.round((W-H)/2) und Math.round((H-W)/2) sind bei halben Werten NICHT
 * exakte Gegenzahlen (Math.round(1.5)=2, aber Math.round(-1.5)=-1, nicht
 * -2 — JS rundet Halbe immer Richtung +Infinity). Über mehrere Rotationen
 * hinweg addierten sich diese Asymmetrien zu einem UNBEGRENZTEN Drift auf:
 * eine 5x2-Form wanderte nach jeweils 4 Rotationen um (+2,+2) weiter, statt
 * zur Ausgangsposition zurückzukehren. roundHalfAwayFromZero() rundet
 * symmetrisch (1.5→2, -1.5→-2) — die beiden Versätze heben sich über einen
 * vollen Rotationszyklus exakt auf, keine Drift mehr, verifiziert für
 * L-Form, 1x5-Linie, 3x4- und 7x2-Rechteck sowie Quadrate.
 */
export function rotateKeys(keys: Set<string>, dir: 1 | -1): Set<string> {
  if (keys.size === 0) return new Set();
  const { minX, minY, maxX, maxY } = boundingBox(keys);
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;

  const offX = roundHalfAwayFromZero((W - H) / 2);
  const offY = roundHalfAwayFromZero((H - W) / 2);
  const newMinX = minX + offX;
  const newMinY = minY + offY;

  const result = new Set<string>();
  for (const k of keys) {
    const [x, y] = fromKey(k);
    const lx = x - minX, ly = y - minY; // lokale Koordinaten (0..W-1, 0..H-1)
    let newLx: number, newLy: number;
    if (dir === 1) {
      // Uhrzeigersinn: Standard-90°-CW-Matrixrotation (W×H → H×W)
      newLx = (H - 1) - ly;
      newLy = lx;
    } else {
      // Gegen den Uhrzeigersinn
      newLx = ly;
      newLy = (W - 1) - lx;
    }
    result.add(key(newMinX + newLx, newMinY + newLy));
  }
  return result;
}

/**
 * Spiegelung um das Bounding-Box-Zentrum.
 * axis='x' → X-Koordinaten werden gespiegelt (horizontaler Flip, links/rechts).
 * axis='y' → Y-Koordinaten werden gespiegelt (vertikaler Flip, oben/unten).
 * Anders als bei Rotation ändert sich die Breite/Höhe hier nicht, daher ist
 * die Spiegelachse immer exakt auf dem Integer-Grid darstellbar — kein
 * Rundungs-Sonderfall nötig.
 */
export function mirrorKeys(keys: Set<string>, axis: 'x' | 'y'): Set<string> {
  if (keys.size === 0) return new Set();
  const { minX, minY, maxX, maxY } = boundingBox(keys);
  const result = new Set<string>();
  for (const k of keys) {
    const [x, y] = fromKey(k);
    const nx = axis === 'x' ? (minX + maxX) - x : x;
    const ny = axis === 'y' ? (minY + maxY) - y : y;
    result.add(key(nx, ny));
  }
  return result;
}
