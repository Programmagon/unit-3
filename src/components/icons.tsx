/**
 * Zentrale Icon-Schicht. Komponenten importieren Icons NUR von hier —
 * nie direkt aus 'lucide-react'. So bleibt die Bibliothek austauschbar,
 * und die drei Zelltyp-Icons (Domäne von Unit-3, in keiner Bibliothek
 * vorhanden) leben am selben Ort.
 */
import type { SVGProps } from 'react';

export {
  Undo2 as IconUndo,
  Redo2 as IconRedo,
  SkipForward as IconStep,
  Play as IconPlay,
  Pause as IconPause,
  Trash2 as IconTrash,
  Save as IconSave,
  FolderOpen as IconOpen,
  Download as IconImport,
  Upload as IconExport,
  Copy as IconCopy,
  Scissors as IconCut,
  ClipboardPaste as IconPaste,
  CopyPlus as IconDuplicate,
  RotateCw as IconRotateCw,
  RotateCcw as IconRotateCcw,
  // Achtung: lucide benennt diese Icons nach der ACHSE, nicht nach der Wirkung.
  // FlipVertical2 zeigt eine senkrechte Achse mit Dreiecken links/rechts = links↔rechts
  // spiegeln = unser „horizontal“ (flipSelection('x')); FlipHorizontal2 entsprechend umgekehrt.
  FlipVertical2 as IconFlipH,
  FlipHorizontal2 as IconFlipV,
  Check as IconCheck,
  X as IconClose,
  Eraser as IconErase,
  Sun as IconSun,
  Moon as IconMoon,
  Monitor as IconMonitor,
  SquareDashedMousePointer as IconSelect,
  TriangleAlert as IconWarning,
  Settings as IconSettings,
  Archive as IconProjects,
  Pencil as IconRename,
  Plus as IconPlus,
  MessageSquareText as IconFeedback,
} from 'lucide-react';

/* Zelltyp-Icons — gleiche Linienführung wie die Glyphen im Canvas
   (renderer.ts), damit Werkzeugleiste und Zellen zusammengehören. */
type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p,
});
export const IconCable    = (p: P) => <svg {...base(p)}><path d="M4 12h16" /></svg>;
export const IconInverter = (p: P) => <svg {...base(p)}><path d="M12 4l8 8-8 8-8-8z" /></svg>;
export const IconDelay    = (p: P) => <svg {...base(p)}><path d="M8 5l11 7-11 7z" /></svg>;
