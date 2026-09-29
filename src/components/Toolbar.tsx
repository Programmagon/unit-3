import { useUIStore } from "../store/uiStore";
import { useSelectionStore } from "../store/selectionStore";
import type { Tool } from "../canvas/input";

const TOOLS: {
  id: Tool;
  icon: string;
  label: string;
  shortcut: string;
  color: string;
}[] = [
  {
    id: "cable",
    icon: "━",
    label: "Kabel",
    shortcut: "1",
    color: "var(--cell-cable)",
  },
  {
    id: "inverter",
    icon: "◇",
    label: "Umkehrer",
    shortcut: "2",
    color: "var(--cell-inv)",
  },
  {
    id: "delay",
    icon: "▷",
    label: "Verzögerer",
    shortcut: "3",
    color: "var(--cell-delay)",
  },
  {
    id: "delete",
    icon: "✕",
    label: "Löschen",
    shortcut: "E",
    color: "var(--cell-delete)",
  },
  {
    id: "select",
    icon: "▭",
    label: "Auswählen",
    shortcut: "S",
    color: "var(--sim-blue)",
  },
];

/**
 * Werkzeug-Auswahl. Keyboard-Shortcuts werden zentral in App.tsx
 * über useKeyboardShortcuts behandelt — Toolbar.tsx kennt nur noch
 * die Werkzeug-Buttons selbst, keine versteckte Abhängigkeit zu SimBar mehr.
 */
export function Toolbar() {
  const tool = useUIStore((s) => s.tool);
  const setTool = useUIStore((s) => s.setTool);
  const commitFloating = useSelectionStore((s) => s.commitFloating);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  return (
    <div
      className="scroll-row"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <span className="logo">
        <img
          src="../../public/logo.png"
          alt="Unit 3"
          //style={{ height: "var(--touch-target)" }}
        ></img>
      </span>

      {/*<span style={{
        color:       'var(--accent)',
        fontWeight:  'bold',
        fontSize:    14,
        marginRight: 4,
        whiteSpace:  'nowrap',
      }}>
        ▣<span className="logo-text"> Unit-3</span>
      </span>*/}

      {TOOLS.map((t) => (
        <button
          key={t.id}
          className="tool-btn"
          onClick={() => {
            // Erneuter Klick auf das bereits aktive Werkzeug → deselektieren
            // (kein Werkzeug aktiv, alles pannt — siehe canvas/input.ts shouldPan).
            const nextTool = tool === t.id ? null : t.id;
            // Gilt für JEDEN Wechsel WEG von "select" — auch das reine
            // Deselektieren (nextTool=null). Eine schwebende Selektion wird
            // dabei committed (State-Machine-Regel: Werkzeugwechsel bestätigt
            // automatisch, siehe selectionStore.ts), eine nur "selected"
            // (nicht schwebende) Selektion wird abgewählt — sie darf einen
            // Werkzeugwechsel nicht überleben, sonst könnte ein ANDERES
            // Werkzeug versehentlich Zellen genau dort platzieren, wo die
            // vergessene Selektion noch lag.
            if (tool === "select" && nextTool !== "select") {
              if (useSelectionStore.getState().selection.status === "floating")
                commitFloating();
              else clearSelection();
            }
            setTool(nextTool);
          }}
          style={{
            background: tool === t.id ? t.color : "transparent",
            color: tool === t.id ? "#000" : t.color,
            borderColor: tool === t.id ? t.color : t.color + "55",
            fontWeight: tool === t.id ? "bold" : "normal",
            flexShrink: 0,
          }}
        >
          {t.icon}
          <span className="btn-label"> {t.label}</span>
          <span className="shortcut"> [{t.shortcut}]</span>
        </button>
      ))}
    </div>
  );
}
