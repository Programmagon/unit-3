import { useGridStore } from '../store/gridStore';
import { useSelectionStore } from '../store/selectionStore';
import {
  IconUndo, IconRedo, IconStep, IconPlay, IconPause,
  IconTrash, IconSave, IconOpen, IconImport,
} from './icons';

interface SimBarProps {
  /** Speichert Grid + Kamera als .u3-Datei. Wird von App.tsx implementiert. */
  onSave: () => void;
  /** Öffnet Datei-Dialog und lädt Grid + Kamera. Wird von App.tsx implementiert. */
  onLoad: () => void;
  /**
   * Öffnet Datei-Dialog und lädt eine exportierte Selektion (.u3sel) in
   * die Zwischenablage — unabhängig von einer aktuellen Selektion, daher
   * hier in SimBar statt in SelectionActions (Schritt 5b, Punkt 6).
   */
  onImportSelection: () => void;
}

/**
 * Simulations-Steuerung: Play/Pause, Schritt, Hz-Slider, Reset, Save/Load.
 * Ab ≤1260px (Tablet-Kompaktmodus in index.css) blendet CSS .hz-control
 * komplett aus; Reset/Undo/Redo/Schritt/Save/Load verlieren nur ihr
 * Textlabel (.btn-label) und bleiben als Icon sichtbar. Der Wrapper hier
 * hat bewusst KEIN flexShrink:0 — er soll sich mit der Toolbar (App.tsx)
 * den verfügbaren Platz fair teilen, statt sie zusammenzudrücken.
 */
export function SimBar({ onSave, onLoad, onImportSelection }: SimBarProps) {
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);
  const hz         = useGridStore(s => s.hz);
  const setHz      = useGridStore(s => s.setHz);
  const clear      = useGridStore(s => s.clear);
  const undo       = useGridStore(s => s.undo);
  const redo       = useGridStore(s => s.redo);
  const canUndo    = useGridStore(s => s.undoStack.length > 0);
  const canRedo    = useGridStore(s => s.redoStack.length > 0);

  return (
    <div className="scroll-row" style={{
      display:     'flex',
      flexWrap:    'wrap',
      alignItems:  'center',
      gap:         6,
      padding:     '0 8px',
      minWidth:    0,
    }}>
      {/* Undo / Redo */}
      <button
        className="btn undo-btn"
        onClick={undo}
        disabled={!canUndo}
        title="Rückgängig [Strg+Z]"
        aria-label="Rückgängig"
      >
        <IconUndo /><span className="btn-label">Undo</span>
      </button>
      <button
        className="btn redo-btn"
        onClick={redo}
        disabled={!canRedo}
        title="Wiederherstellen [Strg+Y]"
        aria-label="Wiederherstellen"
      >
        <IconRedo /><span className="btn-label">Redo</span>
      </button>

      {/* Trenner */}
      <div className="bar-divider" />

      {/* Schritt */}
      <button
        className="btn"
        onClick={() => {
          if (running) return;
          // Simulation muss den ECHTEN Grid-Zustand sehen — eine schwebende
          // Selektion hat ihre Quelle geleert und den Inhalt nur im Speicher
          // (siehe canvas/selection.ts). Erst committen, dann simulieren.
          if (useSelectionStore.getState().selection.status === 'floating') {
            useSelectionStore.getState().commitFloating();
          }
          step();
        }}
        disabled={running}
        title="Schritt [.]"
        aria-label="Schritt"
      >
        <IconStep /><span className="shortcut">[.]</span>
        <span className="btn-label">Schritt</span>
      </button>

      {/* Play / Pause */}
      <button
        className={`btn btn--solid${running ? ' is-stop' : ''}`}
        onClick={() => {
          if (!running && useSelectionStore.getState().selection.status === 'floating') {
            useSelectionStore.getState().commitFloating();
          }
          setRunning(!running);
        }}
        title={`${running ? 'Pause' : 'Play'} [Space]`}
        aria-label={running ? 'Pause' : 'Play'}
      >
        {running ? <IconPause fill="currentColor" /> : <IconPlay fill="currentColor" />}
        {running ? 'Pause' : 'Play'}
        <span className="shortcut">[Space]</span>
      </button>

      {/* Hz-Slider — wird auf Mobile via CSS ausgeblendet */}
      <label className="hz-control">
        <input
          type="range"
          min={1} max={30} value={hz}
          onChange={e => setHz(+e.target.value)}
        />
        <span className="hz-value">{hz} Hz</span>
      </label>

      {/* Reset */}
      <button
        className="btn btn--danger reset-btn"
        onClick={clear}
        title="Zurücksetzen"
        aria-label="Zurücksetzen"
      >
        <IconTrash /><span className="btn-label">Reset</span>
      </button>

      {/* Trenner */}
      <div className="bar-divider" />

      {/* Speichern / Öffnen */}
      <button
        className="btn save-btn"
        onClick={onSave}
        title="Speichern (.u3)"
        aria-label="Speichern"
      >
        <IconSave /><span className="btn-label">Speichern</span>
      </button>
      <button
        className="btn load-btn"
        onClick={onLoad}
        title="Öffnen (.u3/.json)"
        aria-label="Öffnen"
      >
        <IconOpen /><span className="btn-label">Öffnen</span>
      </button>
      <button
        className="btn"
        onClick={onImportSelection}
        title="Selektion importieren (.u3sel)"
        aria-label="Selektion importieren"
      >
        <IconImport /><span className="btn-label">Import</span>
      </button>
    </div>
  );
}
