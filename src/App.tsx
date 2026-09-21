import { useEffect, useRef } from 'react';
import { Canvas }       from './components/Canvas';
import type { CanvasHandle } from './components/Canvas';
import { Toolbar }      from './components/Toolbar';
import { SimBar }       from './components/SimBar';
import { SimControls }  from './components/SimControls';
import { SelectionActions } from './components/SelectionActions';
import { useGridStore } from './store/gridStore';
import { useSelectionStore } from './store/selectionStore';
import { useKeyboardShortcuts } from './store/useKeyboardShortcuts';
import { serialize, deserialize, SerializeError, deserializeSelection } from './lib/serializer';
import { saveToFile, loadFromFile } from './lib/fileIO';

/** `unit3-projekt-YYYY-MM-DD.u3` — Datum wird beim Speichern generiert. */
function suggestedFilename() {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `unit3-projekt-${d}.u3`;
}

export default function App() {
  const step      = useGridStore(s => s.step);
  const isRunning = useGridStore(s => s.isRunning);
  const hz        = useGridStore(s => s.hz);
  const steps     = useGridStore(s => s.stepCount);
  const cells     = useGridStore(s => s.grid.size);
  const grid      = useGridStore(s => s.grid);
  const loadGrid  = useGridStore(s => s.loadGrid);
  const setRunning = useGridStore(s => s.setRunning);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef   = useRef<CanvasHandle>(null);

  // Zentrale Tastatur-Shortcuts — unabhängig davon welche Komponente
  // die zugehörigen Buttons rendert (Toolbar / SimBar)
  // Strg+V: Zeigerposition wenn bekannt, sonst Viewport-Mitte als Fallback
  // (statt (0,0), was je nach Kameraposition weit außerhalb des Sichtbaren
  // liegen kann).
  useKeyboardShortcuts(() =>
    canvasRef.current?.getLastPointerCell() ?? canvasRef.current?.getViewportCenterCell() ?? null
  );

  // Simulations-Schleife
  useEffect(() => {
    if (!isRunning) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(step, 1000 / hz);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, hz, step]);

  // ── Speichern ──────────────────────────────────────────────────────────
  // Speichern während laufender Simulation ist erlaubt — kein setRunning nötig.
  const handleSave = async () => {
    const camera = canvasRef.current?.getCameraSnapshot();
    if (!camera) return; // Canvas noch nicht bereit
    const json = serialize(grid, camera);
    try {
      await saveToFile(json, suggestedFilename(), 'Unit-3 Datei', { 'application/json': ['.u3'] });
    } catch {
      alert('Datei konnte nicht gespeichert werden.');
    }
  };

  // ── Laden ──────────────────────────────────────────────────────────────
  // Simulation wird vor dem Laden gestoppt (setRunning(false)) — auch wenn
  // das Laden selbst fehlschlägt, ist ein gestoppter Zustand hier unkritisch.
  const handleLoad = async () => {
    let text: string;
    try {
      text = await loadFromFile('.u3,.json');
    } catch {
      return; // kein Dialog-Abbruch als Fehler behandeln
    }
    setRunning(false);
    try {
      const { grid: loaded, camera } = deserialize(text);
      useSelectionStore.getState().clearSelection();
      loadGrid(loaded);
      canvasRef.current?.setCameraSnapshot(camera);
    } catch (e) {
      const msg = e instanceof SerializeError ? e.message : 'Datei konnte nicht gelesen werden';
      alert(msg);
    }
  };

  // ── Selektion importieren (.u3sel) ───────────────────────────────────────
  // Unabhängig von handleLoad: lädt keine Grid-Datei, sondern befüllt nur
  // die Zwischenablage — Einfügen passiert danach ganz normal per Strg+V
  // oder dem Einfügen-Button.
  const handleImportSelection = async () => {
    let text: string;
    try {
      text = await loadFromFile('.u3sel,.json');
    } catch {
      return;
    }
    try {
      const cells = deserializeSelection(text);
      // Datei war gültiges JSON mit passender Version, aber am Ende blieb
      // keine einzige gültige Zelle übrig (z. B. versehentlich eine .u3-
      // Grid-Datei statt .u3sel gewählt — deren Zellen haben eine andere
      // Form und werden alle stillschweigend übersprungen). Ohne diesen
      // Hinweis sieht das wie "Import tut nichts" aus.
      if (cells.length === 0) {
        alert('Die Datei enthält keine gültigen Zellen — falsches Dateiformat gewählt?');
        return;
      }
      useSelectionStore.getState().setClipboard(cells);
    } catch (e) {
      const msg = e instanceof SerializeError ? e.message : 'Datei konnte nicht gelesen werden';
      alert(msg);
    }
  };

  return (
    /*
      Layout läuft komplett über CSS Grid (index.css, .app-layout).
      Die drei Kinder werden per grid-area positioniert — DOM-Reihenfolge
      bleibt für Tab-Navigation/Screenreader gleich, nur die visuelle
      Anordnung ändert sich responsiv:
        Desktop (≥ 600px):  toolbar → canvas → status
        Mobile  (< 600px):  canvas  → status → toolbar
      Kein JavaScript für Layout-Entscheidungen.
    */
    <div className="app-layout">

      {/* ── Toolbar + SimBar ─────────────────────────────────────
          Desktop: oben, eine Zeile nebeneinander
          Mobile:  unten, zwei Zeilen übereinander (flex-direction: column)
      ────────────────────────────────────────────────────────── */}
      <header className="top-bar">
        <Toolbar />
        <SimBar onSave={handleSave} onLoad={handleLoad} onImportSelection={handleImportSelection} />
      </header>

      {/* ── Canvas ───────────────────────────────────────────────
          Füllt den verbleibenden Platz (flex: 1).
          .step-overlay: absolut positioniert, nur auf Mobile sichtbar.
      ────────────────────────────────────────────────────────── */}
      <div className="canvas-area">
        <Canvas ref={canvasRef} />
        <SelectionActions getPasteAnchor={() => canvasRef.current?.getViewportCenterCell() ?? null} />
        <div className="step-overlay">
          {steps} Schritte · {cells} Zellen
        </div>
      </div>

      {/* ── Statusleiste ─────────────────────────────────────────
          Loop-Error-Banner + Zähler + Hilfetext.
          Hilfetext wird auf Mobile per CSS ausgeblendet.
      ────────────────────────────────────────────────────────── */}
      <SimControls />

    </div>
  );
}
