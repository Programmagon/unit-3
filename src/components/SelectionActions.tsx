import { useSelectionStore } from '../store/selectionStore';
import { useGridStore }      from '../store/gridStore';
import { boundingBox }       from '../canvas/selection';
import { centeredPasteAnchor } from '../store/selectionOps';
import { serializeSelection } from '../lib/serializer';
import { saveToFile }         from '../lib/fileIO';

interface SelectionActionsProps {
  /** Zell-Position für den Einfügen-Button — siehe App.tsx (Viewport-Mitte). */
  getPasteAnchor: () => [number, number] | null;
}

/**
 * Kontextabhängige Mini-Toolbar für die aktuelle Selektion UND die
 * Zwischenablage. Sichtbar wenn `selected.size > 0` ODER eine Zwischenablage
 * existiert (Einfügen muss auch ohne aktive Selektion per Touch erreichbar
 * sein, nicht nur über Strg+V).
 * Schwebt über dem Canvas (analog zu .step-overlay), zentriert am unteren Rand.
 *
 * Buttons zeigen Icon + Text-Label (`.btn-label`, gleiche Konvention wie
 * Toolbar.tsx/SimBar.tsx) sowie `aria-label` — title-Tooltips lösen auf
 * Touch-Geräten (iPad!) nicht aus. Die Gruppen (Zwischenablage /
 * Transformieren / Exportieren / Löschen) sind durch Trenner
 * (`.sel-action-divider`) visuell abgesetzt.
 *
 * Kein "erst finalisieren" mehr nötig (anders als in früheren Versionen):
 * `selected` ist immer die aktuelle, im Grid tatsächlich vorhandene
 * Position, siehe gridStore.ts/selectionOps.ts. `selected` als React-Closure-
 * Wert ist hier deshalb überall sicher direkt nutzbar — AUSSER unmittelbar
 * NACH copyToClipboard() (siehe handleDuplicate): das mutiert `clipboard`
 * synchron, aber die Closure-Variable `clipboard` von oben zieht das erst
 * beim NÄCHSTEN Render nach — dort weiterhin bewusst .getState() nötig.
 */
export function SelectionActions({ getPasteAnchor }: SelectionActionsProps) {
  const selected        = useSelectionStore(s => s.selected);
  const clipboard        = useSelectionStore(s => s.clipboard);
  const setSelection    = useSelectionStore(s => s.setSelection);
  const clearSelection  = useSelectionStore(s => s.clearSelection);
  const copyToClipboard = useSelectionStore(s => s.copyToClipboard);

  const deleteCells  = useGridStore(s => s.deleteCells);
  const pasteCells   = useGridStore(s => s.pasteCells);
  const rotateCells  = useGridStore(s => s.rotateCells);
  const mirrorCells  = useGridStore(s => s.mirrorCells);

  const hasSelection = selected.size > 0;
  const hasClipboard = !!clipboard && clipboard.length > 0;
  if (!hasSelection && !hasClipboard) return null;

  const handleCopy = () => {
    copyToClipboard(useGridStore.getState().grid);
  };

  const handleCut = () => {
    // Ausschneiden = Kopieren + Löschen, ein Undo-Schritt (deleteCells).
    copyToClipboard(useGridStore.getState().grid);
    deleteCells(selected);
    clearSelection();
  };

  const handleDuplicate = () => {
    // Gleiche DRY-Begründung wie in useKeyboardShortcuts.ts (Strg+D):
    // nutzt copyToClipboard + pasteCells, überschreibt dabei den Strg+C-Inhalt.
    copyToClipboard(useGridStore.getState().grid);
    // Versatz um die volle Breite statt fixem (1,1) — garantiert KEINE
    // Überlappung mit dem Original, unabhängig von der Formgröße.
    const { minX, minY, maxX } = boundingBox(selected);
    const width = maxX - minX + 1;
    // copyToClipboard() mutiert clipboard synchron — die Closure-Variable
    // `clipboard` von oben zieht das erst beim nächsten Render nach, hier
    // bewusst frisch aus dem Store lesen (siehe Doku oben).
    const dup = useSelectionStore.getState().clipboard ?? [];
    const newKeys = pasteCells(dup, minX + width, minY);
    // null = Zielposition überschneidet sich mit fremdem Inhalt (z. B. einer
    // anderen Form direkt rechts daneben) — nichts geschrieben, Selektion
    // bleibt unverändert bestehen statt sie auf nichts zu setzen.
    if (newKeys) setSelection(newKeys);
  };

  const handleRotate = (dir: 1 | -1) => {
    const newKeys = rotateCells(selected, dir);
    // null = die gedrehte Form würde fremde Zellen überschreiben — nichts
    // passiert, Selektion bleibt an ihrer alten Position/Ausrichtung stehen.
    if (newKeys) setSelection(newKeys);
  };

  const handleMirror = (axis: 'x' | 'y') => {
    const newKeys = mirrorCells(selected, axis);
    if (newKeys) setSelection(newKeys);
  };

  const handleDelete = () => {
    deleteCells(selected);
    clearSelection();
  };

  const handlePaste = () => {
    if (!clipboard || clipboard.length === 0) return;
    const anchor = getPasteAnchor() ?? [0, 0];
    // Zentriert einfügen statt linksbündig — siehe centeredPasteAnchor-Doku.
    const [atX, atY] = centeredPasteAnchor(clipboard, anchor[0], anchor[1]);
    const newKeys = pasteCells(clipboard, atX, atY);
    // null = Zielposition belegt (z. B. weil die kopierte Original-Selektion
    // noch genau dort liegt) — nichts eingefügt, alte Selektion bleibt.
    if (newKeys) setSelection(newKeys);
  };

  const handleExport = async () => {
    const grid = useGridStore.getState().grid;
    // Export liest die AKTUELLE Selektion, nicht die Zwischenablage — falls
    // beide unterschiedlich sind (z. B. selektiert, aber noch nicht kopiert),
    // exportieren wir das, was gerade sichtbar markiert ist.
    const { minX, minY } = boundingBox(selected);
    const cells = [...selected].flatMap(k => {
      const cell = grid.get(k);
      if (!cell) return [];
      const [x, y] = k.split(',').map(Number);
      return [{ dx: x - minX, dy: y - minY, type: cell.type, state: cell.state, forced: cell.forced ?? false }];
    });
    const json = serializeSelection(cells);
    const d = new Date().toISOString().slice(0, 10);
    try {
      await saveToFile(json, `unit3-selektion-${d}.u3sel`, 'Unit-3 Selektion', { 'application/json': ['.u3sel'] });
    } catch {
      alert('Selektion konnte nicht exportiert werden.');
    }
  };

  // Die drei Gruppen-Trenner sind nur nötig, wenn tatsächlich Gruppen auf
  // beiden Seiten stehen. Copy/Cut/Duplicate/Rotate*/Mirror*/Export/Delete
  // hängen ausschließlich an hasSelection — ist eine Selektion aktiv, sind
  // IMMER alle vier Gruppen befüllt (Einfügen ist der einzige Button, der
  // unabhängig davon — nur an hasClipboard — hängt und niemals allein eine
  // Gruppe leer lässt). Ohne aktive Selektion (nur Zwischenablage vorhanden)
  // gibt es nur den Einfügen-Button und keine Trenner.
  const showDividers = hasSelection;

  return (
    <div className="selection-actions">
      {hasSelection && (
        <button className="sel-action-btn" onClick={handleCopy} title="Kopieren [Strg+C]" aria-label="Kopieren">
          📋<span className="btn-label"> Kopieren</span><span className="shortcut"> [Strg+C]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={handleCut} title="Ausschneiden [Strg+X]" aria-label="Ausschneiden">
          ✂️<span className="btn-label"> Ausschneiden</span><span className="shortcut"> [Strg+X]</span>
        </button>
      )}
      {hasClipboard && (
        <button className="sel-action-btn" onClick={handlePaste} title="Einfügen [Strg+V]" aria-label="Einfügen">
          📌<span className="btn-label"> Einfügen</span><span className="shortcut"> [Strg+V]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={handleDuplicate} title="Duplizieren [Strg+D]" aria-label="Duplizieren">
          ⧉<span className="btn-label"> Duplizieren</span><span className="shortcut"> [Strg+D]</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="sel-action-btn" onClick={() => handleRotate(1)} title="Im Uhrzeigersinn drehen [R]" aria-label="Im Uhrzeigersinn drehen">
          ↻<span className="btn-label"> Drehen +90°</span><span className="shortcut"> [R]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => handleRotate(-1)} title="Gegen den Uhrzeigersinn drehen [Umschalt+R]" aria-label="Gegen den Uhrzeigersinn drehen">
          ↺<span className="btn-label"> Drehen −90°</span><span className="shortcut"> [⇧R]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => handleMirror('x')} title="Horizontal spiegeln [M]" aria-label="Horizontal spiegeln">
          ⇋<span className="btn-label"> Horizontal</span><span className="shortcut"> [M]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => handleMirror('y')} title="Vertikal spiegeln [Umschalt+M]" aria-label="Vertikal spiegeln">
          ⇵<span className="btn-label"> Vertikal</span><span className="shortcut"> [⇧M]</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="sel-action-btn" onClick={handleExport} title="Selektion exportieren (.u3sel)" aria-label="Selektion exportieren">
          📤<span className="btn-label"> Exportieren</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="sel-action-btn sel-action-danger" onClick={handleDelete} title="Löschen [Entf]" aria-label="Löschen">
          🗑<span className="btn-label"> Löschen</span><span className="shortcut"> [Entf]</span>
        </button>
      )}
    </div>
  );
}
