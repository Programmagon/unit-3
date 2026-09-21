import { useGridStore } from '../store/gridStore';

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
        className="sim-btn undo-btn"
        onClick={undo}
        disabled={!canUndo}
        title="Rückgängig [Strg+Z]"
        style={{
          background:  'transparent',
          color:       canUndo ? 'var(--sim-blue)' : 'var(--border-ui)',
          borderColor: canUndo ? 'var(--sim-blue)' : 'var(--border-ui)',
          flexShrink:  0,
        }}
      >
        ↩<span className="btn-label"> Undo</span>
      </button>
      <button
        className="sim-btn redo-btn"
        onClick={redo}
        disabled={!canRedo}
        title="Wiederherstellen [Strg+Y]"
        style={{
          background:  'transparent',
          color:       canRedo ? 'var(--sim-blue)' : 'var(--border-ui)',
          borderColor: canRedo ? 'var(--sim-blue)' : 'var(--border-ui)',
          flexShrink:  0,
        }}
      >
        ↪<span className="btn-label"> Redo</span>
      </button>

      {/* Trenner */}
      <div style={{
        width:      1,
        alignSelf:  'stretch',
        margin:     '8px 2px',
        background: 'var(--border-ui)',
        flexShrink: 0,
      }} />

      {/* Schritt */}
      <button
        className="sim-btn"
        onClick={() => { if (!running) step(); }}
        disabled={running}
        style={{
          background:  'transparent',
          color:       running ? 'var(--border-ui)' : 'var(--sim-blue)',
          borderColor: running ? 'var(--border-ui)' : 'var(--sim-blue)',
          flexShrink:  0,
        }}
      >
        ⏭<span className="shortcut"> [.]</span>
        <span className="btn-label"> Schritt</span>
      </button>

      {/* Play / Pause */}
      <button
        className="sim-btn"
        onClick={() => setRunning(!running)}
        style={{
          background:  running ? 'var(--sim-red)' : 'var(--sim-green)',
          color:       '#000',
          fontWeight:  'bold',
          border:      'none',
          flexShrink:  0,
        }}
      >
        {running ? '⏸ Pause' : '▶ Play'}
        <span className="shortcut"> [Space]</span>
      </button>

      {/* Hz-Slider — wird auf Mobile via CSS ausgeblendet */}
      <label className="hz-control" style={{
        display:     'flex',
        alignItems:  'center',
        gap:         5,
        fontSize:    11,
        color:       'var(--text-muted)',
        whiteSpace:  'nowrap',
        flexShrink:  0,
      }}>
        <input
          type="range"
          min={1} max={30} value={hz}
          onChange={e => setHz(+e.target.value)}
          style={{ width: 65, accentColor: 'var(--accent)' }}
        />
        <span style={{ color: 'var(--sim-blue)', minWidth: 32 }}>{hz} Hz</span>
      </label>

      {/* Reset — wird auf Mobile via CSS ausgeblendet */}
      <button
        className="sim-btn reset-btn"
        onClick={clear}
        style={{
          background:  'transparent',
          color:       'var(--cell-delete)',
          borderColor: '#662222',
          flexShrink:  0,
        }}
      >
        🗑<span className="btn-label"> Reset</span>
      </button>

      {/* Trenner */}
      <div style={{
        width:      1,
        alignSelf:  'stretch',
        margin:     '8px 2px',
        background: 'var(--border-ui)',
        flexShrink: 0,
      }} />

      {/* Speichern / Öffnen */}
      <button
        className="sim-btn save-btn"
        onClick={onSave}
        title="Speichern (.u3)"
        style={{
          background:  'transparent',
          color:       'var(--sim-blue)',
          borderColor: 'var(--sim-blue)',
          flexShrink:  0,
        }}
      >
        💾<span className="btn-label"> Speichern</span>
      </button>
      <button
        className="sim-btn load-btn"
        onClick={onLoad}
        title="Öffnen (.u3/.json)"
        style={{
          background:  'transparent',
          color:       'var(--sim-blue)',
          borderColor: 'var(--sim-blue)',
          flexShrink:  0,
        }}
      >
        📂<span className="btn-label"> Öffnen</span>
      </button>
      <button
        className="sim-btn"
        onClick={onImportSelection}
        title="Selektion importieren (.u3sel)"
        style={{
          background:  'transparent',
          color:       'var(--sim-blue)',
          borderColor: 'var(--sim-blue)',
          flexShrink:  0,
        }}
      >
        📥<span className="btn-label"> Import</span>
      </button>
    </div>
  );
}
