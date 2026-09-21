import { useGridStore } from '../store/gridStore';
import { useUIStore }   from '../store/uiStore';

/**
 * Statusleiste — Loop-Error-Banner + Zähler + Hilfetext.
 *
 * CSS-Klassen steuern die Sichtbarkeit auf Mobile:
 *   .hint-text  → ausgeblendet auf Mobile (< 600px)
 *   .step-overlay in .canvas-area → übernimmt Zähler auf Mobile
 *
 * BUGFIX: der Hilfetext war bisher IMMER der Platzieren-Hinweis
 * ("Klick: Platzieren · …"), auch wenn das Auswählen-Werkzeug aktiv war —
 * dort bedeutet Klicken/Ziehen aber etwas völlig anderes (Rechteck
 * aufziehen bzw. Selektion verschieben), und Shift/Alt für Hinzufügen/
 * Abziehen sowie R/M für Drehen/Spiegeln standen bislang NIRGENDS im UI,
 * bevor überhaupt eine Selektion existiert (SelectionActions.tsx erscheint
 * erst danach). Der Hinweis wechselt jetzt mit dem aktiven Werkzeug.
 */
export function SimControls() {
  const steps     = useGridStore(s => s.stepCount);
  const cells     = useGridStore(s => s.grid.size);
  const loopError = useGridStore(s => s.loopError);
  const tool      = useUIStore(s => s.tool);

  const hint = tool === 'select'
    ? 'Ziehen: Auswählen · Ziehen auf Selektion: Verschieben · ⇧: Hinzufügen · ' +
      'Alt: Abziehen · R/⇧R: Drehen · M/⇧M: Spiegeln · Strg+C/X/V/D: Kopieren/' +
      'Ausschneiden/Einfügen/Duplizieren'
    : 'Klick: Platzieren · Gleicher Typ ⊕: Force · Rechtsklick/Long-Press: Löschen · ' +
      'Alt+Drag: Schwenken · Scroll/Pinch: Zoom';

  return (
    <div className="status-bar">
      {/* Loop-Error — immer sichtbar wenn gesetzt */}
      {loopError && (
        <div className="loop-error">
          <span style={{ fontSize: 14 }}>⚠</span>
          <strong>SimLoopError —</strong>
          <span>{loopError}</span>
        </div>
      )}

      {/* Zähler + Hilfetext */}
      <div className="status-row">
        <span className="hint-text">{hint}</span>
        <span style={{ color: 'var(--text-dim)', marginRight: 12 }}>
          Schritt: <span style={{ color: 'var(--sim-blue)' }}>{steps}</span>
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          Zellen: <span style={{ color: 'var(--sim-blue)' }}>{cells}</span>
        </span>
      </div>
    </div>
  );
}
