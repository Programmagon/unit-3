import { useEffect, useRef } from 'react';
import { useUIStore }        from './uiStore';
import { useGridStore }      from './gridStore';
import { useSelectionStore } from './selectionStore';
import { boundingBox }       from '../canvas/selection';
import { centeredPasteAnchor } from './selectionOps';

/** Pfeiltaste → Delta einer Zelle, für die Selektions-Nudge weiter unten. */
const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp:    [0, -1],
  ArrowDown:  [0,  1],
  ArrowLeft:  [-1, 0],
  ArrowRight: [1,  0],
};

/** ms ohne weiteren Pfeiltasten-Druck, bevor eine Nudge-Serie als EIN Undo-Schritt abgeschlossen wird. */
const NUDGE_DEBOUNCE_MS = 500;

/**
 * Zentraler Keyboard-Shortcut-Hook.
 *
 * Vorher waren Space/[.] in Toolbar.tsx registriert, obwohl sie zu
 * SimBar gehören — eine versteckte Abhängigkeit. Jetzt lebt die
 * gesamte Tastatur-Logik an einer Stelle (App.tsx), unabhängig davon
 * welche Komponente die zugehörigen Buttons rendert.
 *
 * Kein "erst finalisieren" mehr nötig (siehe selectionOps.ts): `selected`
 * ist immer die aktuelle, im Grid tatsächlich vorhandene Position, daher
 * ist die React-Closure-Variable `selected` hier überall sicher direkt
 * nutzbar — AUSSER unmittelbar nach copyToClipboard() (Strg+D), das
 * `clipboard` synchron mutiert, aber die Closure zieht das erst beim
 * nächsten Render nach.
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
  const deleteCells = useGridStore(s => s.deleteCells);
  const pasteCells  = useGridStore(s => s.pasteCells);
  const rotateCells = useGridStore(s => s.rotateCells);
  const mirrorCells = useGridStore(s => s.mirrorCells);
  const beginSelectionDrag  = useGridStore(s => s.beginSelectionDrag);
  const dragSelectionTo     = useGridStore(s => s.dragSelectionTo);
  const endSelectionDrag    = useGridStore(s => s.endSelectionDrag);
  const cancelSelectionDrag = useGridStore(s => s.cancelSelectionDrag);

  const selected       = useSelectionStore(s => s.selected);
  const clipboard      = useSelectionStore(s => s.clipboard);
  const setSelection   = useSelectionStore(s => s.setSelection);
  const clearSelection = useSelectionStore(s => s.clearSelection);
  const copyToClipboard = useSelectionStore(s => s.copyToClipboard);

  // ── Pfeiltasten-Nudge-Zustand (siehe unten) ─────────────────────────
  // Modul-/Hook-lokal, kein Store nötig — rein transiente UI-Geste, analog
  // zum Maus-Drag in canvas/input.ts.
  const nudgeAccum = useRef<{ dx: number; dy: number } | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // Reine Einzeltasten-Shortcuts (1/2/3/E/S/R/M/Pfeile) müssen Strg/Cmd/
      // Alt ignorieren, sonst kollidieren sie mit Browser-Shortcuts wie
      // Strg+S (Speichern) oder Strg+R (Neuladen). Die explizit modifier-
      // basierten Shortcuts (Strg+C/X/V/D/Z/Y weiter unten) sind davon
      // unberührt.
      const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey;

      // Werkzeuge — eine Selektion darf einen Werkzeugwechsel nicht
      // überleben (siehe Toolbar.tsx für die ausführliche Begründung).
      if (noModifier && e.key === '1') { if (tool === 'select') clearSelection(); setTool('cable'); }
      if (noModifier && e.key === '2') { if (tool === 'select') clearSelection(); setTool('inverter'); }
      if (noModifier && e.key === '3') { if (tool === 'select') clearSelection(); setTool('delay'); }
      if (noModifier && (e.key === 'e' || e.key === 'E')) { if (tool === 'select') clearSelection(); setTool('delete'); }
      if (noModifier && (e.key === 's' || e.key === 'S')) {
        // Entspricht dem Toggle-Verhalten des Werkzeug-Buttons in
        // Toolbar.tsx: erneutes Aktivieren eines bereits aktiven
        // Werkzeugs schaltet es aus.
        if (tool === 'select') { clearSelection(); setTool(null); }
        else setTool('select');
      }

      // ── Selektion: Pfeiltasten-Nudge (nach Tiled-Vorbild) ────────────
      // Nur wenn das Auswählen-Werkzeug aktiv ist und etwas selektiert ist
      // — sonst bleibt ArrowRight der Simulations-Schritt-Shortcut weiter
      // unten (die beiden Bedeutungen würden sonst kollidieren).
      if (noModifier && tool === 'select' && selected.size > 0 && e.key in ARROW_DELTA) {
        e.preventDefault();
        const [ddx, ddy] = ARROW_DELTA[e.key];
        if (!nudgeAccum.current) {
          beginSelectionDrag(selected);
          nudgeAccum.current = { dx: 0, dy: 0 };
        }
        nudgeAccum.current.dx += ddx;
        nudgeAccum.current.dy += ddy;
        dragSelectionTo(nudgeAccum.current.dx, nudgeAccum.current.dy);
        // Mehrere schnell aufeinanderfolgende Nudges (z. B. Pfeiltaste
        // gehalten) sollen EIN Undo-Schritt sein, wie ein Maus-Drag —
        // Timer verschiebt sich mit jedem weiteren Druck nach hinten und
        // schließt den Batch erst, wenn eine Weile Ruhe ist.
        if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
        nudgeTimer.current = setTimeout(() => {
          endSelectionDrag();
          nudgeAccum.current = null;
          nudgeTimer.current = null;
        }, NUDGE_DEBOUNCE_MS);
        return;
      }

      // Simulation
      // e.repeat-Guard: ohne dies togglet Halten der Leertaste (OS-Tastenwiederholung)
      // rasant zwischen Play/Pause hin und her.
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setRunning(!running);
      }
      if (e.key === '.' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!running) step();
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
        // Cancel, nicht Commit — stellt exakt den Zustand von vor einem
        // evtl. noch laufenden Drag wieder her (Aseprite-Präzedenzfall
        // aseprite/aseprite#5102: Escape muss abbrechen, nicht committen).
        // cancelSelectionDrag() ist sicher auch aufzurufen, wenn gar kein
        // Drag lief (No-Op) — deckt auch den Fall ab, dass Escape mitten in
        // einem Maus-Drag gedrückt wird.
        // Falls eine Pfeiltasten-Nudge-Serie offen war: Timer/Zustand direkt
        // zurücksetzen statt den debounced endSelectionDrag() abzuwarten —
        // cancelSelectionDrag() gleich danach macht den Drag ohnehin rückgängig.
        if (nudgeTimer.current) { clearTimeout(nudgeTimer.current); nudgeTimer.current = null; }
        nudgeAccum.current = null;
        cancelSelectionDrag();
        clearSelection();
        // Escape hebt jetzt auch das aktive Werkzeug auf (egal welches) —
        // kein Werkzeug aktiv, alles pannt (siehe canvas/input.ts shouldPan).
        setTool(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
        e.preventDefault();
        deleteCells(selected);
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selected.size > 0) {
        e.preventDefault();
        copyToClipboard(useGridStore.getState().grid);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selected.size > 0) {
        e.preventDefault();
        // Ausschneiden = Kopieren + Löschen. deleteCells pusht genau EINEN
        // Undo-Schritt — copyToClipboard selbst mutiert das Grid nicht.
        copyToClipboard(useGridStore.getState().grid);
        deleteCells(selected);
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.repeat && clipboard && clipboard.length > 0) {
        e.preventDefault();
        const anchor = getPasteAnchor?.() ?? [0, 0];
        // Zentriert einfügen statt linksbündig — siehe centeredPasteAnchor-Doku
        // in selectionOps.ts.
        const [atX, atY] = centeredPasteAnchor(clipboard, anchor[0], anchor[1]);
        const newKeys = pasteCells(clipboard, atX, atY);
        // null = Zielposition belegt — nichts eingefügt, alte Selektion bleibt.
        if (newKeys) setSelection(newKeys);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.repeat && selected.size > 0) {
        e.preventDefault();
        copyToClipboard(useGridStore.getState().grid);
        // Versatz um die volle Breite statt fixem (1,1) — siehe Begründung
        // in SelectionActions.tsx handleDuplicate.
        const { minX, minY, maxX } = boundingBox(selected);
        const width = maxX - minX + 1;
        // copyToClipboard() mutiert clipboard synchron — die Closure-
        // Variable `clipboard` von oben zieht das erst beim nächsten
        // Render nach, hier bewusst frisch aus dem Store lesen.
        const dup = useSelectionStore.getState().clipboard ?? [];
        const newKeys = pasteCells(dup, minX + width, minY);
        if (newKeys) setSelection(newKeys);
        return;
      }
      if (noModifier && (e.key === 'r' || e.key === 'R') && !e.repeat && selected.size > 0) {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        const newKeys = rotateCells(selected, dir);
        // null = die gedrehte Form würde fremde Zellen überschreiben —
        // nichts passiert, Selektion bleibt unverändert stehen.
        if (newKeys) setSelection(newKeys);
        return;
      }
      if (noModifier && (e.key === 'm' || e.key === 'M') && !e.repeat && selected.size > 0) {
        e.preventDefault();
        const axis = e.shiftKey ? 'y' : 'x';
        const newKeys = mirrorCells(selected, axis);
        if (newKeys) setSelection(newKeys);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    };
  }, [
    tool, running, setTool, setRunning, step, undo, redo,
    selected, clipboard, deleteCells, pasteCells, rotateCells, mirrorCells,
    setSelection, clearSelection, copyToClipboard, getPasteAnchor,
    beginSelectionDrag, dragSelectionTo, endSelectionDrag, cancelSelectionDrag,
  ]);
}
