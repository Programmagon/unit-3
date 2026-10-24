import { useSelectionStore } from '../store/selectionStore';
import { extractRegion } from '../canvas/selection';
import { useGridStore } from '../store/gridStore';
import { serializeSelection } from '../lib/serializer';
import { saveToFile }         from '../lib/fileIO';
import { useT }               from '../i18n';
import { useKeys }            from '../lib/useKeys';
import {
  IconCheck, IconClose, IconCopy, IconCut, IconPaste, IconDuplicate,
  IconRotateCw, IconRotateCcw, IconFlipH, IconFlipV, IconExport, IconTrash,
} from './icons';

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
  const t          = useT();
  const keys       = useKeys();
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
      await saveToFile(json, `unit3-${t.lang === 'de' ? 'selektion' : 'selection'}-${d}.u3sel`, 'Unit-3 Selektion', { 'application/json': ['.u3sel'] });
    } catch {
      alert(t('err.exportSelection'));
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
          <button className="btn btn--ghost btn--confirm" onClick={commitFloating} title={keys.titled(t('sel.confirmTitle'), 'Enter')} aria-label={t('sel.confirm')}>
            <IconCheck /><span className="btn-label">{t('sel.confirm')}</span><span className="shortcut">[Enter]</span>
          </button>
          <button className="btn btn--ghost btn--danger" onClick={cancelFloating} title={keys.titled(t('sel.cancelTitle'), 'Esc')} aria-label={t('sel.cancel')}>
            <IconClose /><span className="btn-label">{t('sel.cancel')}</span><span className="shortcut">[Esc]</span>
          </button>
          <div className="sel-action-divider" />
        </>
      )}

      {hasSelection && (
        <button className="btn btn--ghost" onClick={copySelection} title={keys.titled(t('sel.copyTitle'), 'copy')} aria-label={t('sel.copy')}>
          <IconCopy /><span className="btn-label">{t('sel.copy')}</span><span className="shortcut">[{keys.label('copy')}]</span>
        </button>
      )}
      {hasSelection && (
        <button className="btn btn--ghost" onClick={cutSelection} title={keys.titled(t('sel.cutTitle'), 'cut')} aria-label={t('sel.cut')}>
          <IconCut /><span className="btn-label">{t('sel.cut')}</span><span className="shortcut">[{keys.label('cut')}]</span>
        </button>
      )}
      {hasClipboard && (
        <button className="btn btn--ghost" onClick={handlePaste} title={keys.titled(t('sel.pasteTitle'), 'paste')} aria-label={t('sel.paste')}>
          <IconPaste /><span className="btn-label">{t('sel.paste')}</span><span className="shortcut">[{keys.label('paste')}]</span>
        </button>
      )}
      {hasSelection && (
        <button className="btn btn--ghost" onClick={duplicateSelection} title={keys.titled(t('sel.duplicateTitle'), 'duplicate')} aria-label={t('sel.duplicate')}>
          <IconDuplicate /><span className="btn-label">{t('sel.duplicate')}</span><span className="shortcut">[{keys.label('duplicate')}]</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="btn btn--ghost" onClick={() => rotateSelection(1)} title={keys.titled(t('sel.rotateCwTitle'), 'rotateCw')} aria-label={t('sel.rotateCwTitle')}>
          <IconRotateCw /><span className="btn-label">{t('sel.rotateCw')}</span><span className="shortcut">[{keys.label('rotateCw')}]</span>
        </button>
      )}
      {hasSelection && (
        <button className="btn btn--ghost" onClick={() => rotateSelection(-1)} title={keys.titled(t('sel.rotateCcwTitle'), 'rotateCcw')} aria-label={t('sel.rotateCcwTitle')}>
          <IconRotateCcw /><span className="btn-label">{t('sel.rotateCcw')}</span><span className="shortcut">[{keys.label('rotateCcw')}]</span>
        </button>
      )}
      {hasSelection && (
        <button className="btn btn--ghost" onClick={() => flipSelection('x')} title={keys.titled(t('sel.flipHTitle'), 'flipH')} aria-label={t('sel.flipHTitle')}>
          <IconFlipH /><span className="btn-label">{t('sel.flipH')}</span><span className="shortcut">[{keys.label('flipH')}]</span>
        </button>
      )}
      {hasSelection && (
        <button className="btn btn--ghost" onClick={() => flipSelection('y')} title={keys.titled(t('sel.flipVTitle'), 'flipV')} aria-label={t('sel.flipVTitle')}>
          <IconFlipV /><span className="btn-label">{t('sel.flipV')}</span><span className="shortcut">[{keys.label('flipV')}]</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="btn btn--ghost" onClick={handleExport} title={t('sel.exportTitle')} aria-label={t('sel.export')}>
          <IconExport /><span className="btn-label">{t('sel.export')}</span>
        </button>
      )}

      {showDividers && <div className="sel-action-divider" />}

      {hasSelection && (
        <button className="btn btn--ghost btn--danger" onClick={deleteSelectionContents} title={keys.titled(t('sel.deleteTitle'), 'deleteSel')} aria-label={t('sel.delete')}>
          <IconTrash /><span className="btn-label">{t('sel.delete')}</span><span className="shortcut">[{keys.label('deleteSel')}]</span>
        </button>
      )}
    </div>
  );
}
