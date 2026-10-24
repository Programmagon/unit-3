import { useEffect, useRef, type ReactNode } from 'react';
import { useSettingsStore, type PanelId } from '../store/settingsStore';
import { useKeymapStore } from '../store/keymapStore';
import { useT, type TKey } from '../i18n';
import { IconClose } from './icons';

const OPENER_ID: Record<PanelId, string> = { settings: 'settings-btn', projects: 'projects-btn' };

/**
 * Seitenpanel (PC) bzw. Bottom-Sheet (Handy) im Canvas-Bereich — gemeinsame
 * Hülle für Einstellungen und Projekte. Immer nur ein Panel offen.
 *
 * Kein Fokus-Fang (nicht modal): der Canvas bleibt bedienbar. Esc schließt und
 * gibt den Fokus an den Knopf zurück, der das Panel geöffnet hat. Die Esc-
 * Behandlung läuft in der Capture-Phase, damit der globale Handler nicht
 * gleichzeitig eine Auswahl aufhebt. data-no-shortcuts hält die globalen
 * Tastenkürzel (Leertaste = Play, Buchstaben = Werkzeug) aus dem Panel heraus.
 * Auf dem Handy dient der Kopf als Griff zum Wegziehen nach unten.
 */
export function PanelShell(props: {
  id: PanelId;
  title: TKey;
  closeLabel: TKey;
  children: ReactNode;
}) {
  const { id, title, closeLabel, children } = props;
  const t = useT();
  const open = useSettingsStore(s => s.panel === id);
  const openPanel = useSettingsStore(s => s.openPanel);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);

  const close = () => {
    openPanel(null);
    document.getElementById(OPENER_ID[id])?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Beim Aufnehmen einer Taste bricht Esc nur die Aufnahme ab (KeyBindings.tsx)
      if (useKeymapStore.getState().capturing !== null) return;
      e.stopPropagation();
      e.preventDefault();
      openPanel(null);
      document.getElementById(OPENER_ID[id])?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, id, openPanel]);

  if (!open) return null;

  return (
    <aside
      id={`${id}-panel`}
      className="settings-panel"
      role="dialog"
      aria-label={t(title)}
      data-no-shortcuts
    >
      <header
        className="settings-head"
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragStartY.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={e => {
          const y0 = dragStartY.current;
          dragStartY.current = null;
          if (y0 !== null && e.clientY - y0 > 60) close();
        }}
        onPointerCancel={() => { dragStartY.current = null; }}
      >
        <span className="settings-grip" aria-hidden />
        <h2>{t(title)}</h2>
        <button
          ref={closeRef}
          type="button"
          className="btn"
          aria-label={t(closeLabel)}
          title={t('set.closeTitle')}
          onClick={close}
        >
          <IconClose />
        </button>
      </header>
      <div className="settings-body">{children}</div>
    </aside>
  );
}
