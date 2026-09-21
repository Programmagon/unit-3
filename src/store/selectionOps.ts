import { useGridStore }      from './gridStore';
import { useSelectionStore } from './selectionStore';
import type { ClipboardCell } from './selectionStore';
import { translateKeys }     from '../canvas/selection';

/**
 * ═══════════════════════════════════════════════════════════════════
 * REGELSET: Wann wird eine schwebende Verschiebung (pendingOffset)
 * committed, wann verworfen?
 * ═══════════════════════════════════════════════════════════════════
 * Orientiert an etablierten Open-Source-Pixel-Editoren (GIMPs "Floating
 * Selection", Aseprites "Move Selection") statt einer Ad-hoc-Regel pro
 * Aufrufer — genau DAS führte bisher dazu, dass an einzelnen Stellen
 * committed wurde, wo es niemand erwartet hätte.
 *
 * COMMIT → finalizePendingMove() (schreibt ins Grid, EIN Undo-Schritt):
 *   • Eine echte NEUE Aktion beginnt, die das Ergebnis der Verschiebung
 *     braucht: Kopieren, Ausschneiden, Einfügen, Duplizieren, Rotieren,
 *     Spiegeln, Löschen, Exportieren, eine neue Rechteckauswahl,
 *     Hinzufügen/Abziehen per Shift/Alt-Klick, Tap außerhalb der
 *     Selektion zum Abwählen.
 *     (GIMP: "You can anchor the floating selection […] by clicking
 *     anywhere on the image except on the floating selection." — jede
 *     andere Interaktion anchert/committed die schwebende Auswahl.)
 *   • WERKZEUG-WECHSEL — weg von "select", inklusive Abwählen des
 *     bereits aktiven Werkzeugs per Klick/Taste. BUGFIX: dabei muss auch
 *     die Selektion SELBST aufgehoben werden (clearSelection()), nicht nur
 *     die schwebende Verschiebung committed — sonst blieb die Selektion
 *     (samt sichtbarem Rahmen und aktiver SelectionActions-Leiste) über den
 *     Werkzeugwechsel hinweg bestehen, und ein komplett anderes Werkzeug
 *     (z. B. Kabel) konnte versehentlich Zellen genau dort platzieren, wo
 *     die vergessene Selektion noch lag — setCell überschreibt ohne
 *     Rückfrage. Reihenfolge: erst finalizePendingMove() (Position
 *     erhalten), DANN clearSelection() (loslassen).
 *   • Aktionen, die den ECHTEN (nicht nur visuell verschobenen)
 *     Grid-Zustand lesen müssen, bevor sie selbst laufen: Simulation
 *     starten/steppen, Speichern. Das ist kein "unwanted commit",
 *     sondern die Kehrseite — ein FEHLENDES, für Korrektheit nötiges
 *     Commit (sonst simuliert/speichert man einen älteren Stand als
 *     den gerade sichtbaren).
 *
 * CANCEL → NUR verwerfen (clearSelection() bzw. direkt pendingOffset
 * zurücksetzen), finalizePendingMove() davor darf NICHT aufgerufen werden:
 *   • Escape / expliziter Abbruch. Aseprite hatte das ursprünglich
 *     GENAU ANDERSHERUM (Escape committete die Verschiebung) und hat es
 *     2025 bewusst als Bug korrigiert (aseprite/aseprite#5102): "Pressing
 *     Escape will remove the selection, dropping the pixels there
 *     without undoing anything […] It seems removing the selection
 *     takes preference over cancelling the drag and drop operation when
 *     it should be the opposite." Escape muss die Original-Position
 *     wiederherstellen, keinen Undo-Schritt erzeugen.
 *   • Undo / Redo / Reset / Datei laden — bezieht sich auf einen
 *     Grid-Zustand, der gerade verlassen wird; ein Commit davor wäre ein
 *     Undo-Schritt für einen Zwischenzustand, den es nie geben sollte.
 *     (Bereits korrekt in gridStore.ts: undo/redo/clear rufen
 *     clearSelection() auf, nie finalizePendingMove().)
 *   • Ein zweiter Finger setzt während eines laufenden Drags auf und
 *     Pinch übernimmt — nur die GERADE laufende Geste wird verworfen,
 *     eine vorher bereits akkumulierte (aber noch nicht finalisierte)
 *     Verschiebung bleibt unangetastet. (Bereits korrekt: Canvas.tsx
 *     onSelectCancel setzt nur previewOffsetRef zurück, nicht
 *     pendingOffset im Store.)
 *
 * NICHTS TUN (weder committen noch verwerfen):
 *   • Tap auf die aktuell (ggf. schwebend verschobene) Selektion ohne
 *     jede Bewegung — es ist keine neue Aktion passiert.
 *   • Reines Rendern — pendingOffset ist rein visuell, bis eine der
 *     obigen Situationen eintritt.
 * ═══════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════
 * KOLLISIONS-POLICY: Fremde Zellen überschreiben oder blockieren?
 * ═══════════════════════════════════════════════════════════════════
 * Zwei unterschiedliche Policies, je nachdem ob die Aktion eine
 * Live-Vorschau hat, in der eine Kollision VOR dem Commit sichtbar wäre:
 *
 * • moveCells (Verschieben per Drag): überschreibt weiterhin bewusst.
 *   renderSelectionOverlay() (renderer.ts) zeigt eine rote Kollisions-
 *   warnung WÄHREND des Drags — der Nutzer sieht den Konflikt vor dem
 *   Loslassen und kann ausweichen. Committen trotz Warnung ist eine
 *   bewusste Entscheidung, kein Versehen.
 *
 * • rotateCells/mirrorCells/pasteCells (und darüber Duplizieren, das
 *   pasteCells wiederverwendet): BLOCKIEREN bei Kollision (geben `null`
 *   zurück, No-Op — kein Undo-Schritt, Selektion bleibt unverändert).
 *   Diese Aktionen committen sofort per Klick/Taste, OHNE Vorschau — eine
 *   Kollision wäre sofort und ohne jede Vorwarnung destruktiv. Besonders
 *   bei Rotieren tückisch: Breite/Höhe tauschen die Rollen, die gedrehte
 *   Form kann dadurch in Bereiche hineinragen, die die ungedrehte Form nie
 *   berührt hat. Bei Einfügen kann der Anker (Viewport-Mitte/Zeiger) auch
 *   die gerade erst kopierte, noch nicht deselektierte Original-Selektion
 *   selbst treffen.
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Schreibt eine schwebende Verschiebung final ins Grid — EIN Undo-Schritt,
 * unabhängig davon wie viele einzelne Drags dazu beigetragen haben.
 * No-Op wenn gerade nichts schwebt (pendingOffset = {0,0}).
 *
 * Wann dies aufgerufen werden darf/muss bzw. NICHT aufgerufen werden darf:
 * siehe Regelset oben.
 */
export function finalizePendingMove(): void {
  const { selected, pendingOffset, setSelection, setPendingOffset } =
    useSelectionStore.getState();
  if (pendingOffset.dx === 0 && pendingOffset.dy === 0) return;
  useGridStore.getState().moveCells(selected, pendingOffset.dx, pendingOffset.dy);
  setSelection(translateKeys(selected, pendingOffset.dx, pendingOffset.dy));
  setPendingOffset({ dx: 0, dy: 0 });
}

/**
 * BUGFIX: gridStore.pasteCells() platziert Zellen relativ zu (atX, atY) als
 * OBERE LINKE ECKE (ClipboardCell.dx/dy sind immer >= 0, siehe
 * copyToClipboard in selectionStore.ts). Sowohl der Einfügen-Button
 * (Anker = Viewport-Mitte, siehe Canvas.tsx getViewportCenterCell) als auch
 * Strg+V (Anker = Zeigerposition) sind aber als "hier soll die Selektion
 * erscheinen"-Punkt gedacht — bei einer linksbündigen Platzierung landet
 * z. B. eine 10x10-Form beim Klick auf "Einfügen" nicht mittig, sondern
 * größtenteils unten rechts vom Ankerpunkt und kann so auf einem kleinen
 * Viewport teilweise außerhalb des sichtbaren Bereichs erscheinen — obwohl
 * die Viewport-Mitte ausdrücklich als "immer sichtbarer" Anker gewählt wurde.
 *
 * Berechnet daher die tatsächliche obere-linke Ecke so, dass die Bounding
 * Box der Zwischenablage bei (atX, atY) ZENTRIERT liegt.
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
