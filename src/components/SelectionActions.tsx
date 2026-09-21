import { useSelectionStore } from '../store/selectionStore';
import { extractRegion } from '../canvas/selection';
import { useGridStore } from '../store/gridStore';
import { serializeSelection } from '../lib/serializer';
import { saveToFile }         from '../lib/fileIO';

interface SelectionActionsProps {
  /** Zell-Position für den Einfügen-Button — siehe App.tsx (Viewport-Mitte). */
  getPasteAnchor: () => [number, number] | null;
}

/**
 * Kontextabhängige Mini-Toolbar für die aktuelle Selektion UND die
 * Zwischenablage. Sichtbar bei 'selected'/'floating' ODER wenn eine
 * Zwischenablage existiert (Einfügen muss auch ohne aktive Selektion per
 * Touch erreichbar sein, nicht nur über Strg+V).
 * Schwebt über dem Canvas (analog zu .step-overlay), zentriert am unteren Rand.
 *
 * Buttons zeigen Icon + Text-Label (`.btn-label`) sowie `aria-label` —
 * title-Tooltips lösen auf Touch-Geräten (iPad!) nicht aus.
 *
 * NEU (State Machine statt Set<string>+pendingOffset, siehe canvas/selection.ts
 * für die ausführliche Architektur-Begründung): Rotieren/Spiegeln/Verschieben
 * passieren rein im Speicher, committen NICHT automatisch — die Selektion
 * bleibt nach jeder dieser Aktionen bewusst "floating", bis explizit
 * bestätigt (✓ / Enter) oder abgebrochen (✕ / Escape) wird, oder bis eine
 * andere Aktion sie automatisch committed (siehe selectionStore.ts
 * resolvePointerDown/pasteClipboard/duplicateSelection). Die beiden Buttons
 * dafür erscheinen nur, solange tatsächlich etwas schwebt.
 */
export function SelectionActions({ getPasteAnchor }: SelectionActionsProps) {
  const selection  = useSelectionStore(s => s.selection);
  const clipboard  = useSelectionStore(s => s.clipboard);
  const copySelection    = useSelectionStore(s => s.copySelection);
  const cutSelection     = useSelectionStore(s => s.cutSelection);
  const pasteClipboard   = useSelectionStore(s => s.pasteClipboard);
  const duplicateSelection = useSelectionStore(s => s.duplicateSelection);
  const deleteSelectionContents = useSelectionStore(s => s.deleteSelectionContents);
  const rotateSelection  = useSelectionStore(s => s.rotateSelection);
  const flipSelection    = useSelectionStore(s => s.flipSelection);
  const commitFloating   = useSelectionStore(s => s.commitFloating);
  const cancelFloating   = useSelectionStore(s => s.cancelFloating);

  const hasSelection = selection.status === 'selected' || selection.status === 'floating';
  const isFloating   = selection.status === 'floating';
  const hasClipboard = !!clipboard && clipboard.buffer.length > 0;
  if (!hasSelection && !hasClipboard) return null;

  const handlePaste = () => {
    const anchor = getPasteAnchor() ?? [0, 0];
    pasteClipboard({ x: anchor[0], y: anchor[1] });
  };

  const handleExport = async () => {
    if (selection.status !== 'selected' && selection.status !== 'floating') return;
    const buffer = selection.status === 'floating'
      ? selection.buffer
      : extractRegion(useGridStore.getState().grid, selection.rect);
    const json = serializeSelection(buffer);
    const d = new Date().toISOString().slice(0, 10);
    try {
      await saveToFile(json, `unit3-selektion-${d}.u3sel`, 'Unit-3 Selektion', { 'application/json': ['.u3sel'] });
    } catch {
      alert('Selektion konnte nicht exportiert werden.');
    }
  };

  // Die drei Gruppen-Trenner sind nur nötig, wenn tatsächlich Gruppen auf
  // beiden Seiten stehen. Copy/Cut/Duplicate/Rotate*/Flip*/Export/Delete
  // hängen ausschließlich an hasSelection — ist eine Selektion aktiv, sind
  // IMMER alle Gruppen befüllt.
  const showDividers = hasSelection;

  return (
    <div className="selection-actions">
      {isFloating && (
        <>
          <button className="sel-action-btn sel-action-confirm" onClick={commitFloating} title="Bestätigen [Enter]" aria-label="Bestätigen">
            ✓<span className="btn-label"> Bestätigen</span><span className="shortcut"> [⏎]</span>
          </button>
          <button className="sel-action-btn sel-action-danger" onClick={cancelFloating} title="Abbrechen [Esc]" aria-label="Abbrechen">
            ✕<span className="btn-label"> Abbrechen</span><span className="shortcut"> [Esc]</span>
          </button>
          <div className="sel-action-divider" />
        </>
      )}

      {hasSelection && (
        <button className="sel-action-btn" onClick={copySelection} title="Kopieren [Strg+C]" aria-label="Kopieren">
          📋<span className="btn-label"> Kopieren</span><span className="shortcut"> [Strg+C]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={cutSelection} title="Ausschneiden [Strg+X]" aria-label="Ausschneiden">
          ✂️<span className="btn-label"> Ausschneiden</span><span className="shortcut"> [Strg+X]</span>
        </button>
      )}
      {hasClipboard && (
        <button className="sel-action-btn" onClick={handlePaste} title="Einfügen [Strg+V]" aria-label="Einfügen">
          📌<span className="btn-label"> Einfügen</span><span className="shortcut"> [Strg+V]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={duplicateSelection} title="Duplizieren [Strg+D]" aria-label="Duplizieren">
          ⧉<span className="btn-label"> Duplizieren</span><span className="shortcut"> [Strg+D]</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="sel-action-btn" onClick={() => rotateSelection(1)} title="Im Uhrzeigersinn drehen [R]" aria-label="Im Uhrzeigersinn drehen">
          ↻<span className="btn-label"> Drehen +90°</span><span className="shortcut"> [R]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => rotateSelection(-1)} title="Gegen den Uhrzeigersinn drehen [Umschalt+R]" aria-label="Gegen den Uhrzeigersinn drehen">
          ↺<span className="btn-label"> Drehen −90°</span><span className="shortcut"> [⇧R]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => flipSelection('x')} title="Horizontal spiegeln [F]" aria-label="Horizontal spiegeln">
          ⇋<span className="btn-label"> Horizontal</span><span className="shortcut"> [F]</span>
        </button>
      )}
      {hasSelection && (
        <button className="sel-action-btn" onClick={() => flipSelection('y')} title="Vertikal spiegeln [Umschalt+F]" aria-label="Vertikal spiegeln">
          ⇵<span className="btn-label"> Vertikal</span><span className="shortcut"> [⇧F]</span>
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
        <button className="sel-action-btn sel-action-danger" onClick={deleteSelectionContents} title="Löschen [Entf]" aria-label="Löschen">
          🗑<span className="btn-label"> Löschen</span><span className="shortcut"> [Entf]</span>
        </button>
      )}
    </div>
  );
}
