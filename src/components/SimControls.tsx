import { useGridStore } from '../store/gridStore';
import { useUIStore }   from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { IconWarning }  from './icons';
import { HzControl }    from './HzControl';
import { useT }         from '../i18n';
import { useKeys }      from '../lib/useKeys';

/**
 * Statusleiste — Loop-Error-Banner + Zähler + Hilfetext.
 *
 * CSS-Klassen steuern die Sichtbarkeit auf Mobile:
 *   .hint-text  → ausgeblendet auf Mobile (< 600px)
 *   .step-overlay in .canvas-area → übernimmt Zähler auf Mobile
 *
 * Der Hilfetext wechselt mit dem aktiven Werkzeug — beim Auswählen-Werkzeug
 * bedeutet Klicken/Ziehen etwas anderes als bei den Platzier-Werkzeugen.
 */
export function SimControls() {
  const t         = useT();
  const keys      = useKeys();
  const steps     = useGridStore(s => s.stepCount);
  const cells     = useGridStore(s => s.grid.size);
  const loopError = useGridStore(s => s.loopError);
  const tool      = useUIStore(s => s.tool);
  const touchTap  = useSettingsStore(s => s.settings.touchTap);

  const hint = tool === 'select'
    ? t('hint.select', {
        rotate: `${keys.label('rotateCw')} / ${keys.label('rotateCcw')}`,
        flip:   `${keys.label('flipH')} / ${keys.label('flipV')}`,
        clip:   ['copy', 'cut', 'paste', 'duplicate'].map(a => keys.label(a as 'copy')).join(' / '),
      })
    : touchTap === 'delete' ? t('hint.placeSwap') : t('hint.place');

  return (
    <div className="status-bar">
      {/* Loop-Error — immer sichtbar wenn gesetzt */}
      {loopError && (
        <div className="loop-error">
          <IconWarning aria-hidden />
          <strong>{t('status.simError')} —</strong>
          <span>{t('err.simLoop')}</span>
        </div>
      )}

      {/* Zähler + Hilfetext */}
      <div className="status-row">
        <span className="hint-text">{hint}</span>
        <HzControl where="status" />
        <span className="status-item">
          {t('status.steps')}: <span className="status-num">{steps}</span>
        </span>
        <span className="status-item">
          {t('status.cells')}: <span className="status-num">{cells}</span>
        </span>
      </div>
    </div>
  );
}
