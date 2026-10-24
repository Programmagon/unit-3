import { useEffect } from 'react';
import { useUIStore }        from './uiStore';
import { useGridStore }      from './gridStore';
import { useSelectionStore } from './selectionStore';
import { useKeymapStore } from './keymapStore';
import { comboFromEvent } from '../lib/keymap';

/** Pfeiltaste → Delta einer Zelle, für die Selektions-Nudge weiter unten. */
const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp:    [0, -1],
  ArrowDown:  [0,  1],
  ArrowLeft:  [-1, 0],
  ArrowRight: [1,  0],
};

/**
 * Zentraler Keyboard-Shortcut-Hook.
 *
 * Selektions-Shortcuts folgen jetzt dem State-Machine-Modell (siehe
 * canvas/selection.ts / selectionStore.ts): Rotieren/Spiegeln/Verschieben
 * schreiben NIE direkt ins Grid, sondern nur an eine schwebende Selektion
 * im Speicher — daher gibt es kein "erst finalisieren" mehr wie im alten
 * pendingOffset-Modell. Neu: Enter bestätigt eine schwebende Selektion
 * explizit (zusätzlich zu den automatischen Commit-Auslösern wie
 * Werkzeugwechsel oder Klick außerhalb).
 *
 * @param getPasteAnchor Liefert die zuletzt bekannte Zeiger-Zellposition für
 *   Strg+V (siehe Canvas.tsx CanvasHandle.getLastPointerCell). Optional, da
 *   nicht jeder Aufrufer Zugriff auf den Canvas hat — ohne Angabe fügt
 *   Strg+V bei (0,0) ein.
 */
export function useKeyboardShortcuts(getPasteAnchor?: () => [number, number] | null) {
  const tool       = useUIStore(s => s.tool);
  const setTool    = useUIStore(s => s.setTool);
  const step       = useGridStore(s => s.step);
  const running    = useGridStore(s => s.isRunning);
  const setRunning = useGridStore(s => s.setRunning);
  const undo       = useGridStore(s => s.undo);
  const redo       = useGridStore(s => s.redo);

  const selection  = useSelectionStore(s => s.selection);
  const clipboard  = useSelectionStore(s => s.clipboard);
  const copySelection    = useSelectionStore(s => s.copySelection);
  const cutSelection     = useSelectionStore(s => s.cutSelection);
  const pasteClipboard   = useSelectionStore(s => s.pasteClipboard);
  const duplicateSelection = useSelectionStore(s => s.duplicateSelection);
  const deleteSelectionContents = useSelectionStore(s => s.deleteSelectionContents);
  const rotateSelection  = useSelectionStore(s => s.rotateSelection);
  const flipSelection    = useSelectionStore(s => s.flipSelection);
  const nudgeSelection   = useSelectionStore(s => s.nudgeSelection);
  const commitFloating   = useSelectionStore(s => s.commitFloating);
  const clearSelection   = useSelectionStore(s => s.clearSelection);
  const escapeSelection  = useSelectionStore(s => s.escape);

  const lookup     = useKeymapStore(s => s.lookup);

  const hasSelection = selection.status === 'selected' || selection.status === 'floating';

  useEffect(() => {
    /** Werkzeugwechsel: schwebende Selektion committen, sonst nur abwählen
     *  — eine Selektion darf einen Werkzeugwechsel nicht überleben (mit
     *  einem ANDEREN Werkzeug könnte man sonst versehentlich Zellen genau
     *  dort platzieren, wo die vergessene Selektion noch lag). */
    const releaseSelectionForToolSwitch = () => {
      if (useSelectionStore.getState().selection.status === 'floating') commitFloating();
      else clearSelection();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      // Einstellungsmenü & Co.: Leertaste/Buchstaben dort gehören dem fokussierten Bedienelement
      if (target.closest?.('[data-no-shortcuts]')) return;
      // Beim Aufnehmen einer neuen Taste (Einstellungen → Tastenkürzel) nichts auslösen
      if (useKeymapStore.getState().capturing !== null) return;

      const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey;

      // ── Feste Tasten ──────────────────────────────────────────────
      // Pfeiltasten-Nudge (nach Tiled-Vorbild): nur mit aktivem Auswählen-
      // Werkzeug und Selektion — sonst bleibt der Pfeil nach rechts der
      // Simulations-Schritt (Zweitbelegung von "step"). nudgeSelection schreibt
      // nie ins Grid; beliebig viele Nudges werden erst bei EINEM commitFloating()
      // zu einem einzigen Undo-Schritt.
      if (noModifier && tool === 'select' && hasSelection && e.key in ARROW_DELTA) {
        e.preventDefault();
        const [dx, dy] = ARROW_DELTA[e.key];
        nudgeSelection(dx, dy);
        return;
      }
      if (e.key === 'Escape') {
        // Bei schwebender Selektion: exakt den Zustand von vor dem Anheben
        // wiederherstellen (kein Undo-Schritt) — sonst abwählen.
        escapeSelection();
        // Escape hebt auch das aktive Werkzeug auf (egal welches) — kein
        // Werkzeug aktiv, alles pannt (siehe canvas/input.ts shouldPan).
        setTool(null);
        return;
      }
      if (e.key === 'Enter' && selection.status === 'floating') {
        e.preventDefault();
        commitFloating();
        return;
      }

      // ── Belegbare Aktionen ────────────────────────────────────────
      const combo = comboFromEvent(e);
      const action = combo ? lookup.get(combo) : undefined;
      if (!action) return;

      switch (action) {
        case 'toolCable':    if (tool === 'select') releaseSelectionForToolSwitch(); setTool('cable'); break;
        case 'toolInverter': if (tool === 'select') releaseSelectionForToolSwitch(); setTool('inverter'); break;
        case 'toolDelay':    if (tool === 'select') releaseSelectionForToolSwitch(); setTool('delay'); break;
        case 'toolErase':    if (tool === 'select') releaseSelectionForToolSwitch(); setTool('delete'); break;
        case 'toolSelect':
          // Entspricht dem Toggle-Verhalten des Werkzeug-Buttons in
          // Toolbar.tsx: erneutes Aktivieren eines aktiven Werkzeugs schaltet es aus.
          if (tool === 'select') { releaseSelectionForToolSwitch(); setTool(null); }
          else setTool('select');
          break;

        case 'play':
          // e.repeat-Guard: ohne dies togglet Halten der Taste (OS-Wiederholung) rasant Play/Pause.
          // Schwebende Selektion vor dem Start committen — die Simulation muss den echten Grid-Zustand sehen.
          e.preventDefault();
          if (e.repeat) break;
          if (!running && selection.status === 'floating') commitFloating();
          setRunning(!running);
          break;
        case 'step':
          e.preventDefault();
          if (!running) {
            if (selection.status === 'floating') commitFloating();
            step();
          }
          break;

        case 'undo': e.preventDefault(); undo(); break;
        case 'redo': e.preventDefault(); redo(); break;

        case 'deleteSel':  if (hasSelection) { e.preventDefault(); deleteSelectionContents(); } break;
        case 'copy':       if (hasSelection) { e.preventDefault(); copySelection(); } break;
        case 'cut':        if (hasSelection) { e.preventDefault(); cutSelection(); } break;
        case 'paste':
          if (!e.repeat && clipboard && clipboard.buffer.length > 0) {
            e.preventDefault();
            const anchor = getPasteAnchor?.() ?? [0, 0];
            pasteClipboard({ x: anchor[0], y: anchor[1] });
          }
          break;
        case 'duplicate':  if (!e.repeat && hasSelection) { e.preventDefault(); duplicateSelection(); } break;
        case 'rotateCw':   if (!e.repeat && hasSelection) { e.preventDefault(); rotateSelection(1); } break;
        case 'rotateCcw':  if (!e.repeat && hasSelection) { e.preventDefault(); rotateSelection(-1); } break;
        // flipH/flipV: "Flip" statt "Mirror" (Namenskonvention aus dem Referenzprojekt)
        case 'flipH':      if (!e.repeat && hasSelection) { e.preventDefault(); flipSelection('x'); } break;
        case 'flipV':      if (!e.repeat && hasSelection) { e.preventDefault(); flipSelection('y'); } break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    lookup, tool, running, setTool, setRunning, step, undo, redo,
    selection, clipboard, hasSelection, getPasteAnchor,
    copySelection, cutSelection, pasteClipboard, duplicateSelection,
    deleteSelectionContents, rotateSelection, flipSelection, nudgeSelection,
    commitFloating, clearSelection, escapeSelection,
  ]);
}
