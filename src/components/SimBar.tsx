import { useGridStore } from '../store/gridStore';
import { useSelectionStore } from '../store/selectionStore';
import {
  IconUndo, IconRedo, IconStep, IconPlay, IconPause,
  IconTrash, IconSave, IconOpen, IconImport, IconProjects,
} from './icons';
import { HzControl } from './HzControl';
import { ThemeToggle } from './ThemeToggle';
import { SettingsButton } from './SettingsMenu';
import { useSettingsStore } from '../store/settingsStore';
import { useT } from '../i18n';
import { useKeys } from '../lib/useKeys';

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
 * Ab ≤1754px zeigt CSS den Hz-Regler stattdessen in der Statusleiste
 * (SimControls); Reset/Undo/Redo/Schritt/Save/Load verlieren stufenweise ihr
 * Kürzel bzw. Textlabel (.btn-label) und bleiben als Icon sichtbar. Der Wrapper hier
 * hat bewusst KEIN flexShrink:0 — er soll sich mit der Toolbar (App.tsx)
 * den verfügbaren Platz fair teilen, statt sie zusammenzudrücken.
 */
export function SimBar({ onSave, onLoad, onImportSelection }: SimBarProps) {
  const t          = useT();
  const keys       = useKeys();
  const projectsOpen = useSettingsStore(s => s.panel === 'projects');
  const openPanel  = useSettingsStore(s => s.openPanel);
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);
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
        title={keys.titled(t('bar.undoTitle'), 'undo')}
        data-key={keys.badge('undo')}
        aria-label={t('bar.undo')}
      >
        <IconUndo /><span className="btn-label">{t('bar.undo')}</span>
      </button>
      <button
        className="btn redo-btn"
        onClick={redo}
        disabled={!canRedo}
        title={keys.titled(t('bar.redoTitle'), 'redo')}
        data-key={keys.badge('redo')}
        aria-label={t('bar.redo')}
      >
        <IconRedo /><span className="btn-label">{t('bar.redo')}</span>
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
        title={keys.titled(t('bar.stepTitle'), 'step')}
        data-key={keys.badge('step')}
        aria-label={t('bar.step')}
      >
        <IconStep />
        <span className="btn-label">{t('bar.step')}</span>
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
        title={keys.titled(running ? t('bar.pauseTitle') : t('bar.playTitle'), 'play')}
        data-key={keys.badge('play')}
        aria-label={running ? t('bar.pause') : t('bar.play')}
      >
        {running ? <IconPause fill="currentColor" /> : <IconPlay fill="currentColor" />}
        {running ? t('bar.pause') : t('bar.play')}
      </button>

      {/* Hz-Regler: hier ab 1755 px, darunter in der Statusleiste (CSS) */}
      <HzControl where="bar" />

      {/* Reset */}
      <button
        className="btn btn--danger reset-btn"
        onClick={clear}
        title={t('bar.clearTitle')}
        aria-label={t('bar.clear')}
      >
        <IconTrash /><span className="btn-label">{t('bar.clear')}</span>
      </button>

      {/* Trenner */}
      <div className="bar-divider" />

      {/* Speichern / Öffnen */}
      <button
        className="btn save-btn"
        onClick={onSave}
        title={t('bar.saveTitle')}
        aria-label={t('bar.save')}
      >
        <IconSave /><span className="btn-label">{t('bar.save')}</span>
      </button>
      <button
        className="btn load-btn"
        onClick={onLoad}
        title={t('bar.openTitle')}
        aria-label={t('bar.open')}
      >
        <IconOpen /><span className="btn-label">{t('bar.open')}</span>
      </button>
      <button
        className="btn"
        onClick={onImportSelection}
        title={t('bar.importTitle')}
        aria-label={t('bar.import')}
      >
        <IconImport /><span className="btn-label">{t('bar.import')}</span>
      </button>
      <button
        id="projects-btn"
        className="btn"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={projectsOpen}
        aria-controls="projects-panel"
        onClick={() => openPanel(projectsOpen ? null : 'projects')}
        title={t('bar.projectsTitle')}
        aria-label={t('bar.projects')}
      >
        <IconProjects /><span className="btn-label">{t('bar.projects')}</span>
      </button>

      <div className="bar-divider" />
      <ThemeToggle />
      <SettingsButton />
    </div>
  );
}
