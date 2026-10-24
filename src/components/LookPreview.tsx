import { useEffect, useRef } from 'react';
import { renderLookPreview, PREVIEW_COLS, PREVIEW_ROWS } from '../canvas/renderer';
import { styleForLook, type LookId } from '../canvas/looks';
import { useThemePref } from '../lib/useThemePref';

const ZOOM = 22;

/** Kleine Vorschau eines Looks (fester Beispiel-Ausschnitt, aktuelles Farbschema). */
export function LookPreview({ look }: { look: LookId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themePref = useThemePref(); // neu zeichnen bei Farbschema-Wechsel

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(PREVIEW_COLS * ZOOM * dpr);
    c.height = Math.round(PREVIEW_ROWS * ZOOM * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderLookPreview(ctx, styleForLook(look), ZOOM);
  }, [look, themePref]);

  return (
    <canvas
      ref={ref}
      className="look-preview"
      aria-hidden
      style={{ width: PREVIEW_COLS * ZOOM, height: PREVIEW_ROWS * ZOOM }}
    />
  );
}
