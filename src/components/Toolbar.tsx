import { useUIStore } from "../store/uiStore";
import { useSelectionStore } from "../store/selectionStore";
import type { Tool } from "../canvas/input";
import type { ComponentType } from "react";
import { Logo } from "./Logo";
import {
  IconCable,
  IconInverter,
  IconDelay,
  IconErase,
  IconSelect,
} from "./icons";

const TOOLS: {
  id: Tool;
  Icon: ComponentType;
  label: string;
  shortcut: string;
  cls: string;
}[] = [
  { id: "cable",    Icon: IconCable,    label: "Kabel",      shortcut: "1", cls: "btn--tool btn--cable" },
  { id: "inverter", Icon: IconInverter, label: "Umkehrer",   shortcut: "2", cls: "btn--tool btn--inv" },
  { id: "delay",    Icon: IconDelay,    label: "Verzögerer", shortcut: "3", cls: "btn--tool btn--delay" },
  { id: "delete",   Icon: IconErase,    label: "Löschen",    shortcut: "E", cls: "btn--danger" },
  { id: "select",   Icon: IconSelect,   label: "Auswählen",  shortcut: "S", cls: "" },
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
      <Logo />

      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`btn ${t.cls}`.trim()}
          aria-pressed={tool === t.id}
          aria-label={t.label}
          title={`${t.label} [${t.shortcut}]`}
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
        >
          <t.Icon />
          <span className="btn-label"> {t.label}</span>
          <span className="shortcut"> [{t.shortcut}]</span>
        </button>
      ))}
    </div>
  );
}
