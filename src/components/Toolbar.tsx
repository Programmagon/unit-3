import { useUIStore } from "../store/uiStore";
import { useSelectionStore } from "../store/selectionStore";
import type { Tool } from "../canvas/input";
import type { ComponentType } from "react";
import { Logo } from "./Logo";
import { useT, type TKey } from "../i18n";
import { useKeys } from "../lib/useKeys";
import type { ActionId } from "../lib/keymap";
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
  label: TKey;
  action: ActionId;
  cls: string;
}[] = [
  { id: "cable",    Icon: IconCable,    label: "tool.cable",      action: "toolCable", cls: "btn--tool btn--cable" },
  { id: "inverter", Icon: IconInverter, label: "tool.inverter",   action: "toolInverter", cls: "btn--tool btn--inv" },
  { id: "delay",    Icon: IconDelay,    label: "tool.delay", action: "toolDelay", cls: "btn--tool btn--delay" },
  { id: "delete",   Icon: IconErase,    label: "tool.delete",    action: "toolErase", cls: "btn--danger" },
  { id: "select",   Icon: IconSelect,   label: "tool.select",  action: "toolSelect", cls: "" },
];

/**
 * Werkzeug-Auswahl. Keyboard-Shortcuts werden zentral in App.tsx
 * über useKeyboardShortcuts behandelt — Toolbar.tsx kennt nur noch
 * die Werkzeug-Buttons selbst, keine versteckte Abhängigkeit zu SimBar mehr.
 */
export function Toolbar() {
  const t = useT();
  const keys = useKeys();
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

      {TOOLS.map((tl) => (
        <button
          key={tl.id}
          className={`btn ${tl.cls}`.trim()}
          aria-pressed={tool === tl.id}
          aria-label={t(tl.label)}
          title={keys.titled(t(tl.label), tl.action)}
          data-key={keys.badge(tl.action)}
          onClick={() => {
            // Erneuter Klick auf das bereits aktive Werkzeug → deselektieren
            // (kein Werkzeug aktiv, alles pannt — siehe canvas/input.ts shouldPan).
            const nextTool = tool === tl.id ? null : tl.id;
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
          <tl.Icon />
          <span className="btn-label"> {t(tl.label)}</span>
        </button>
      ))}
    </div>
  );
}
