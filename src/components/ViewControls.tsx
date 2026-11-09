import type { RefObject } from 'react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { useKeys } from '../lib/useKeys';
import type { CanvasHandle } from './Canvas';
import { IconFit } from './icons';

/**
 * Oben rechts im Canvas: „Alles anzeigen“ (passt die Schaltung ins Bild ein) und
 * der Hinweis, wenn man so weit herausgezoomt hat, dass das Bearbeiten aus ist.
 * Den Hinweis blendet CSS ein, sobald der Canvas data-overview="true" trägt
 * (Canvas.tsx setzt das beim Zeichnen); hier hängt er nur vom Werkzeug ab.
 */
export function ViewControls({ canvas }: { canvas: RefObject<CanvasHandle | null> }) {
  const t = useT();
  const keys = useKeys();
  const tool = useUIStore(s => s.tool);
  const editing = tool !== null && tool !== 'select';
  return (
    <>
      <button
        type="button"
        className="btn view-fit"
        aria-label={t('view.fit')}
        title={keys.titled(t('view.fit'), 'fitView')}
        onClick={() => canvas.current?.fitView()}
      >
        <IconFit />
      </button>
      {editing && <div className="overview-hint" role="status">{t('view.overviewHint')}</div>}
    </>
  );
}
