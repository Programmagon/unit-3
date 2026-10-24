import { useGridStore } from '../store/gridStore';
import { useT } from '../i18n';

/**
 * Geschwindigkeits-Regler (Hz). Wird an ZWEI Stellen gerendert (SimBar und
 * Statusleiste); CSS (.hz-control--bar / .hz-control--status in index.css)
 * zeigt immer genau eine davon — so ist der Wert auf jedem Gerät sichtbar.
 */
export function HzControl({ where }: { where: 'bar' | 'status' }) {
  const t    = useT();
  const hz   = useGridStore(s => s.hz);
  const setHz = useGridStore(s => s.setHz);
  return (
    <label className={`hz-control hz-control--${where}`}>
      <input
        type="range"
        min={1} max={30} value={hz}
        aria-label={t('bar.speed')}
        onChange={e => setHz(+e.target.value)}
      />
      <span className="hz-value">{hz} Hz</span>
    </label>
  );
}
