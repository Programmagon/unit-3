import { useEffect } from 'react';
import { useUIStore }        from './uiStore';
import { useGridStore }      from './gridStore';
import { useSelectionStore } from './selectionStore';
import { boundingBox }       from '../canvas/selection';
import { finalizePendingMove, centeredPasteAnchor } from './selectionOps';

/**
 * Zentraler Keyboard-Shortcut-Hook.
 *
 * Vorher waren Space/[.] in Toolbar.tsx registriert, obwohl sie zu
 * SimBar gehören — eine versteckte Abhängigkeit. Jetzt lebt die
 * gesamte Tastatur-Logik an einer Stelle (App.tsx), unabhängig davon
 * welche Komponente die zugehörigen Buttons rendert.
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

  const selected       = useSelectionStore(s => s.selected);
  const clipboard      = useSelectionStore(s => s.clipboard);
  const setSelection   = useSelectionStore(s => s.setSelection);
  const clearSelection = useSelectionStore(s => s.clearSelection);
  const copyToClipboard = useSelectionStore(s => s.copyToClipboard);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      // BUGFIX: die 1-Buchstaben-Shortcuts unten prüften bisher NIE, ob
      // Strg/Cmd/Alt gehalten wird. Dadurch wurde z. B. Strg+S (Seite
      // speichern) durch setTool('select') "mitgetriggert", und — schwer-
      // wiegender — Strg+R und Strg+Umschalt+R (Browser-Neuladen / Hard
      // Reload) wurden per e.preventDefault() im Rotieren-Zweig unten
      // GESCHLUCKT, sobald eine Selektion aktiv war. noModifier schützt
      // alle reinen Einzeltasten-Shortcuts davor, mit Browser-Shortcuts zu
      // kollidieren; die explizit modifier-basierten Shortcuts (Strg+C/X/V/
      // D/Z/Y weiter unten) sind davon unberührt.
      const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey;

      // Werkzeuge
      // BUGFIX: Werkzeugwechsel hob bisher nur die schwebende Verschiebung
      // auf (finalizePendingMove), die Selektion selbst blieb aktiv — siehe
      // ausführliche Begründung in Toolbar.tsx (gleicher Fix). clearSelection
      // ruft finalizePendingMove NICHT ersetzend auf, sondern ergänzend:
      // erst committen (siehe Regelset), dann deselektieren.
      if (noModifier && e.key === '1') {
        if (tool === 'select') { finalizePendingMove(); clearSelection(); }
        setTool('cable');
      }
      if (noModifier && e.key === '2') {
        if (tool === 'select') { finalizePendingMove(); clearSelection(); }
        setTool('inverter');
      }
      if (noModifier && e.key === '3') {
        if (tool === 'select') { finalizePendingMove(); clearSelection(); }
        setTool('delay');
      }
      if (noModifier && (e.key === 'e' || e.key === 'E')) {
        if (tool === 'select') { finalizePendingMove(); clearSelection(); }
        setTool('delete');
      }
      if (noModifier && (e.key === 's' || e.key === 'S')) {
        // BUGFIX: entspricht jetzt dem Toggle-Verhalten des Werkzeug-Buttons
        // in Toolbar.tsx (erneutes Aktivieren eines bereits aktiven
        // Werkzeugs schaltet es aus) — vorher setzte die Taste "S" das
        // Werkzeug bei wiederholtem Drücken immer wieder auf 'select',
        // während der gleichnamige Button es beim zweiten Klick deaktivierte.
        if (tool === 'select') { finalizePendingMove(); clearSelection(); setTool(null); }
        else setTool('select');
      }

      // Simulation
      // BUGFIX (Kehrseite des Commit-Themas — siehe Regelset in
      // selectionOps.ts): Simulation liest/mutiert den ECHTEN Grid-Zustand.
      // Ohne Finalisieren würde bei schwebender Verschiebung ein älterer
      // Stand simuliert als der gerade sichtbare. Nur beim STARTEN nötig,
      // nicht beim Pausieren — Pause verändert den Grid-Zustand nicht.
      // e.repeat-Guard: ohne dies togglet Halten der Leertaste (OS-Tastenwiederholung)
      // rasant zwischen Play/Pause hin und her.
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (!running) finalizePendingMove();
        setRunning(!running);
      }
      if (e.key === '.' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!running) { finalizePendingMove(); step(); }
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

      // ── Selektion (Schritt 5 / 5b) ──────────────────────────────────
      if (e.key === 'Escape') {
        // BUGFIX: Escape rief vorher finalizePendingMove() auf — committete
        // die schwebende Verschiebung also, statt sie zu verwerfen. Exakt
        // dieses Verhalten hatte Aseprite ursprünglich auch und hat es 2025
        // bewusst als Bug gefixt (aseprite/aseprite#5102): Escape muss die
        // Original-Position wiederherstellen, keinen Undo-Schritt erzeugen
        // (siehe Regelset in selectionOps.ts). clearSelection() setzt
        // pendingOffset bereits mit zurück — kein finalizePendingMove() hier.
        clearSelection();
        // Escape hebt jetzt auch das aktive Werkzeug auf (egal welches) —
        // kein Werkzeug aktiv, alles pannt (siehe canvas/input.ts shouldPan).
        setTool(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
        e.preventDefault();
        finalizePendingMove();
        deleteCells(useSelectionStore.getState().selected);
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selected.size > 0) {
        e.preventDefault();
        finalizePendingMove();
        copyToClipboard(useGridStore.getState().grid);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selected.size > 0) {
        e.preventDefault();
        // Ausschneiden = Kopieren + Löschen. deleteCells pusht genau EINEN
        // Undo-Schritt — copyToClipboard selbst mutiert das Grid nicht.
        finalizePendingMove();
        const freshSelected = useSelectionStore.getState().selected;
        copyToClipboard(useGridStore.getState().grid);
        deleteCells(freshSelected);
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.repeat && clipboard && clipboard.length > 0) {
        e.preventDefault();
        // Bugfix: eine evtl. schwebende Verschiebung muss vor dem Einfügen
        // finalisiert werden — sonst "erbt" die neu eingefügte Selektion
        // später fälschlich den alten pendingOffset.
        finalizePendingMove();
        const anchor = getPasteAnchor?.() ?? [0, 0];
        // Zentriert einfügen statt linksbündig — siehe centeredPasteAnchor-Doku
        // in selectionOps.ts.
        const [atX, atY] = centeredPasteAnchor(clipboard, anchor[0], anchor[1]);
        const newKeys = pasteCells(clipboard, atX, atY);
        // null = Zielposition belegt — nichts eingefügt, alte Selektion
        // bleibt bestehen (siehe pasteCells-Doku in gridStore.ts).
        if (newKeys) setSelection(newKeys);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.repeat && selected.size > 0) {
        e.preventDefault();
        finalizePendingMove();
        const freshSelected = useSelectionStore.getState().selected;
        copyToClipboard(useGridStore.getState().grid);
        // Versatz um die volle Breite statt fixem (1,1) — siehe Begründung
        // in SelectionActions.tsx handleDuplicate.
        const { minX, minY, maxX } = boundingBox(freshSelected);
        const width = maxX - minX + 1;
        const dup = useSelectionStore.getState().clipboard ?? [];
        const newKeys = pasteCells(dup, minX + width, minY);
        if (newKeys) setSelection(newKeys);
        return;
      }
      if (noModifier && (e.key === 'r' || e.key === 'R') && !e.repeat && selected.size > 0) {
        e.preventDefault();
        finalizePendingMove();
        const freshSelected = useSelectionStore.getState().selected;
        const dir = e.shiftKey ? -1 : 1;
        const newKeys = rotateCells(freshSelected, dir);
        if (newKeys) setSelection(newKeys);
        return;
      }
      if (noModifier && (e.key === 'm' || e.key === 'M') && !e.repeat && selected.size > 0) {
        e.preventDefault();
        finalizePendingMove();
        const freshSelected = useSelectionStore.getState().selected;
        const axis = e.shiftKey ? 'y' : 'x';
        const newKeys = mirrorCells(freshSelected, axis);
        if (newKeys) setSelection(newKeys);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tool, running, setTool, setRunning, step, undo, redo,
    selected, clipboard, deleteCells, pasteCells, rotateCells, mirrorCells,
    setSelection, clearSelection, copyToClipboard, getPasteAnchor,
  ]);
}
