import { useEffect, useState } from 'react';
import { useKeymapStore } from '../store/keymapStore';
import { ACTION_GROUPS, comboFromEvent, formatCombo, type ActionId } from '../lib/keymap';
import { useT, type TKey } from '../i18n';
import { IconRotateCcw } from './icons';

const LABEL: Record<ActionId, TKey> = {
  toolCable: 'tool.cable', toolInverter: 'tool.inverter', toolDelay: 'tool.delay',
  toolErase: 'tool.delete', toolSelect: 'tool.select',
  play: 'bar.play', step: 'bar.step',
  undo: 'bar.undo', redo: 'bar.redo',
  copy: 'sel.copy', cut: 'sel.cut', paste: 'sel.paste', duplicate: 'sel.duplicate',
  rotateCw: 'sel.rotateCw', rotateCcw: 'sel.rotateCcw',
  flipH: 'sel.flipH', flipV: 'sel.flipV', deleteSel: 'sel.delete',
};

const GROUP_LABEL = {
  tools: 'keys.group.tools', sim: 'keys.group.sim', edit: 'keys.group.edit', selection: 'keys.group.selection',
} as const satisfies Record<string, TKey>;

/**
 * Liste der belegbaren Aktionen mit der aktuellen Taste. "Ändern" nimmt die
 * nächste Taste (bzw. Kombination) auf — funktioniert auch auf dem Tablet mit
 * Hardware-Tastatur. Esc bricht ab; belegte oder reservierte Tasten werden mit
 * Hinweis abgelehnt, statt stillschweigend etwas anderes zu überschreiben.
 */
export function KeyBindings() {
  const t = useT();
  const bindings = useKeymapStore(s => s.bindings);
  const overrides = useKeymapStore(s => s.overrides);
  const capturing = useKeymapStore(s => s.capturing);
  const setCapturing = useKeymapStore(s => s.setCapturing);
  const setBinding = useKeymapStore(s => s.setBinding);
  const resetBinding = useKeymapStore(s => s.resetBinding);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (capturing === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(null); setNote(null); return; }
      const combo = comboFromEvent(e);
      if (combo === null) return; // nur Modifikator gedrückt: auf die eigentliche Taste warten
      const shown = formatCombo(combo, t.lang);
      const res = setBinding(capturing, combo);
      if (res.ok) { setCapturing(null); setNote(null); }
      else if (res.reason === 'reserved') setNote(t('keys.reserved', { key: shown }));
      else setNote(t('keys.conflict', { key: shown, action: t(LABEL[res.other]) }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, setCapturing, setBinding, t]);

  // Panel schließen oder Komponente verlassen: Aufnahme beenden
  useEffect(() => () => setCapturing(null), [setCapturing]);

  return (
    <div className="keys">
      {ACTION_GROUPS.map(g => (
        <div key={g.id} className="settings-field">
          <div className="settings-label">{t(GROUP_LABEL[g.id])}</div>
          <ul className="keys-list">
            {g.actions.map(a => {
              const combo = bindings[a][0];
              const changed = overrides[a] !== undefined;
              const isCapturing = capturing === a;
              return (
                <li key={a} className="keys-row">
                  <span className="keys-action">{t(LABEL[a])}</span>
                  <kbd className="keys-combo" data-capturing={isCapturing}>
                    {isCapturing ? t('keys.press') : combo ? formatCombo(combo, t.lang) : t('keys.none')}
                  </kbd>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={isCapturing}
                    aria-label={t('keys.changeAria', { action: t(LABEL[a]) })}
                    onClick={() => { setNote(null); setCapturing(isCapturing ? null : a); }}
                  >
                    {t('keys.change')}
                  </button>
                  <button
                    type="button"
                    className="btn keys-reset"
                    disabled={!changed}
                    title={t('keys.resetOne', { action: t(LABEL[a]) })}
                    aria-label={t('keys.resetOne', { action: t(LABEL[a]) })}
                    onClick={() => { resetBinding(a); setNote(null); }}
                  >
                    <IconRotateCcw />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="settings-hint" role="status">{note ?? t('keys.hint')}</p>
      <p className="settings-hint">{t('keys.fixed')}</p>
    </div>
  );
}
