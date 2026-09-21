import { useEffect } from 'react';
import { useUIStore }        from './uiStore';
import { useGridStore }      from './gridStore';
import { useSelectionStore } from './selectionStore';

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
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Reine Einzeltasten-Shortcuts (1/2/3/E/S/R/F/Pfeile) müssen Strg/Cmd/
      // Alt ignorieren, sonst kollidieren sie mit Browser-Shortcuts wie
      // Strg+S (Speichern) oder Strg+R (Neuladen). Die explizit modifier-
      // basierten Shortcuts (Strg+C/X/V/D/Z/Y weiter unten) sind davon
      // unberührt.
      const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey;

      // Werkzeuge
      if (noModifier && e.key === '1') { if (tool === 'select') releaseSelectionForToolSwitch(); setTool('cable'); }
      if (noModifier && e.key === '2') { if (tool === 'select') releaseSelectionForToolSwitch(); setTool('inverter'); }
      if (noModifier && e.key === '3') { if (tool === 'select') releaseSelectionForToolSwitch(); setTool('delay'); }
      if (noModifier && (e.key === 'e' || e.key === 'E')) { if (tool === 'select') releaseSelectionForToolSwitch(); setTool('delete'); }
      if (noModifier && (e.key === 's' || e.key === 'S')) {
        // Entspricht dem Toggle-Verhalten des Werkzeug-Buttons in
        // Toolbar.tsx: erneutes Aktivieren eines bereits aktiven
        // Werkzeugs schaltet es aus.
        if (tool === 'select') { releaseSelectionForToolSwitch(); setTool(null); }
        else setTool('select');
      }

      // ── Selektion: Pfeiltasten-Nudge (nach Tiled-Vorbild) ────────────
      // Nur wenn das Auswählen-Werkzeug aktiv ist und etwas selektiert ist
      // — sonst bleibt ArrowRight der Simulations-Schritt-Shortcut weiter
      // unten (die beiden Bedeutungen würden sonst kollidieren). Kein
      // Debounce/Batching mehr nötig: nudgeSelection schreibt nie ins Grid,
      // beliebig viele Nudges werden erst bei EINEM commitFloating() zu
      // einem einzigen Undo-Schritt.
      if (noModifier && tool === 'select' && hasSelection && e.key in ARROW_DELTA) {
        e.preventDefault();
        const [dx, dy] = ARROW_DELTA[e.key];
        nudgeSelection(dx, dy);
        return;
      }

      // Simulation
      // e.repeat-Guard: ohne dies togglet Halten der Leertaste (OS-Tastenwiederholung)
      // rasant zwischen Play/Pause hin und her.
      // Schwebende Selektion vor Simulationsstart committen (analog zu
      // SimBar.tsx) — Simulation muss den echten Grid-Zustand sehen, nicht
      // eine noch nicht geschriebene, nur im Speicher schwebende Änderung.
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (!running && selection.status === 'floating') commitFloating();
        setRunning(!running);
      }
      if (e.key === '.' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!running) {
          if (selection.status === 'floating') commitFloating();
          step();
        }
      }

      // Undo/Redo
      // e.key.toLowerCase() statt direktem Vergleich mit 'z'/'y': bei
      // gedrückter Shift-Taste liefert der Browser i. d. R. den Großbuchstaben
      // ('Z' statt 'z') — ein reiner === 'z'-Vergleich würde Ctrl+Shift+Z
      // dadurch nie erkennen.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        redo();
      }

      // ── Selektion ─────────────────────────────────────────────────
      if (e.key === 'Escape') {
        // Bei schwebender Selektion: exakt den Zustand von vor dem
        // Anheben wiederherstellen (kein Undo-Schritt) — sonst abwählen.
        escapeSelection();
        // Escape hebt jetzt auch das aktive Werkzeug auf (egal welches) —
        // kein Werkzeug aktiv, alles pannt (siehe canvas/input.ts shouldPan).
        setTool(null);
        return;
      }
      if (e.key === 'Enter' && selection.status === 'floating') {
        e.preventDefault();
        commitFloating();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        deleteSelectionContents();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && hasSelection) {
        e.preventDefault();
        copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && hasSelection) {
        e.preventDefault();
        cutSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.repeat && clipboard && clipboard.buffer.length > 0) {
        e.preventDefault();
        const anchor = getPasteAnchor?.() ?? [0, 0];
        pasteClipboard({ x: anchor[0], y: anchor[1] });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.repeat && hasSelection) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (noModifier && (e.key === 'r' || e.key === 'R') && !e.repeat && hasSelection) {
        e.preventDefault();
        rotateSelection(e.shiftKey ? -1 : 1);
        return;
      }
      // F/⇧F statt M/⇧M — Namenskonvention aus dem Referenzprojekt
      // übernommen ("Flip" statt "Mirror"), auch wenn die UI weiterhin
      // "Spiegeln" sagt.
      if (noModifier && (e.key === 'f' || e.key === 'F') && !e.repeat && hasSelection) {
        e.preventDefault();
        flipSelection(e.shiftKey ? 'y' : 'x');
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tool, running, setTool, setRunning, step, undo, redo,
    selection, clipboard, hasSelection, getPasteAnchor,
    copySelection, cutSelection, pasteClipboard, duplicateSelection,
    deleteSelectionContents, rotateSelection, flipSelection, nudgeSelection,
    commitFloating, clearSelection, escapeSelection,
  ]);
}
