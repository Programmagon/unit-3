import type { ClipboardCell } from './selectionStore';

/**
 * ═══════════════════════════════════════════════════════════════════
 * ARCHITEKTUR: Selektion als LIVE-Zustand, kein "Pending"-Zwischenschritt
 * ═══════════════════════════════════════════════════════════════════
 * Frühere Versionen sammelten eine laufende Verschiebung in einem separaten
 * `pendingOffset` (rein visuell, nicht im Grid) und mussten sich an vielen
 * Stellen merken, wann dieser Zwischenstand "finalisiert" (ins Grid
 * geschrieben) oder verworfen werden muss — genau DAS war die Quelle
 * mehrerer Bugs (Escape committete statt abzubrechen, Speichern/Simulation
 * lasen einen veralteten Grid-Stand, Selektion überlebte Werkzeugwechsel).
 *
 * Neues Modell, orientiert an Tiled/Godot/Unity-Tilemap-Editoren: eine
 * Selektion verhält sich wie ein physisches Objekt. Man hebt es auf (Klick
 * trifft die Selektion), bewegt es — und die Bewegung passiert SOFORT,
 * direkt im Grid (siehe gridStore.ts: beginSelectionDrag/dragSelectionTo/
 * endSelectionDrag/cancelSelectionDrag). Loslassen bestätigt einfach den
 * bereits erreichten Zustand (endSelectionDrag bündelt nur noch den ganzen
 * Drag zu einem Undo-Schritt). Escape stellt exakt den Zustand von vor dem
 * Aufheben wieder her (cancelSelectionDrag), ohne dass irgendein anderer
 * Code-Pfad etwas "finalisieren" müsste — das Grid ist zu jedem Zeitpunkt
 * bereits der korrekte, sichtbare Zustand.
 *
 * Konsequenz: Speichern, Simulation starten/steppen, Kopieren usw. brauchen
 * KEIN "erst finalisieren" mehr — sie lesen einfach den aktuellen Grid-
 * Zustand, der ist immer richtig.
 *
 * Kollisions-Regel (einheitlich für Verschieben/Rotieren/Spiegeln/
 * Einfügen/Duplizieren, siehe gridStore.ts collidesWithForeign): eine
 * Operation kann nie stillschweigend fremde, nicht zur eigenen Auswahl
 * gehörende Zellen überschreiben. Beim Verschieben "stoppt" die Selektion
 * an einer Blockade (dragSelectionTo gibt false zurück, Grid bleibt an der
 * letzten gültigen Position); bei Rotieren/Spiegeln/Einfügen/Duplizieren
 * (die keine Live-Vorschau haben) wird die ganze Operation abgelehnt
 * (Rückgabe null). Nichts wird je zerstört, ohne dass der Nutzer es sieht.
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Berechnet die Ziel-Ankerposition (oben-links), sodass die Bounding Box
 * der Zwischenablage-Zellen bei (atX, atY) ZENTRIERT erscheint statt mit
 * ihrer oberen linken Ecke dort zu beginnen.
 *
 * gridStore.pasteCells() platziert Zellen relativ zu (atX, atY) als OBERE
 * LINKE ECKE (ClipboardCell.dx/dy sind beide >= 0). Sowohl der Einfügen-
 * Button (Anker = Viewport-Mitte, siehe Canvas.tsx getViewportCenterCell)
 * als auch Strg+V (Anker = Zeigerposition) sind aber als "hier soll die
 * Selektion erscheinen"-Punkt gedacht — bei einer linksbündigen Platzierung
 * landet z. B. eine 10x10-Form beim Einfügen nicht mittig, sondern
 * größtenteils unten rechts vom Ankerpunkt.
 */
export function centeredPasteAnchor(
  cells: ClipboardCell[],
  atX: number,
  atY: number,
): [number, number] {
  if (cells.length === 0) return [atX, atY];
  let maxDx = 0, maxDy = 0;
  for (const c of cells) {
    if (c.dx > maxDx) maxDx = c.dx;
    if (c.dy > maxDy) maxDy = c.dy;
  }
  const width  = maxDx + 1;
  const height = maxDy + 1;
  return [atX - Math.floor(width / 2), atY - Math.floor(height / 2)];
}
