/**
 * Tastenkürzel: Aktionen, Standardbelegung, Erkennen und Anzeigen von Kombinationen.
 * Reine Funktionen, kein React, kein Store (Speicher: store/keymapStore.ts).
 *
 * Eine Kombination ist ein String aus Modifikatoren und Taste, immer in der
 * Reihenfolge ctrl → alt → shift → Taste, alles klein: "ctrl+shift+z", "r",
 * "space", ".". "ctrl" gilt für Strg UND Cmd (macOS/iPadOS), damit dieselbe
 * Belegung auf jedem Gerät funktioniert. Die Taste ist event.key in Kleinschrift;
 * Leertaste heißt "space", "+" heißt "plus".
 */

export const ACTION_IDS = [
  'toolCable', 'toolInverter', 'toolDelay', 'toolErase', 'toolSelect',
  'play', 'step',
  'undo', 'redo',
  'copy', 'cut', 'paste', 'duplicate',
  'rotateCw', 'rotateCcw', 'flipH', 'flipV', 'deleteSel',
] as const;
export type ActionId = typeof ACTION_IDS[number];

export type ActionGroup = 'tools' | 'sim' | 'edit' | 'selection';

export const ACTION_GROUPS: readonly { id: ActionGroup; actions: readonly ActionId[] }[] = [
  { id: 'tools',     actions: ['toolCable', 'toolInverter', 'toolDelay', 'toolErase', 'toolSelect'] },
  { id: 'sim',       actions: ['play', 'step'] },
  { id: 'edit',      actions: ['undo', 'redo', 'copy', 'cut', 'paste', 'duplicate'] },
  { id: 'selection', actions: ['rotateCw', 'rotateCcw', 'flipH', 'flipV', 'deleteSel'] },
];

/** Standardbelegung. Mehrere Einträge = gleichwertige Alternativen (Zweitbelegungen). */
export const DEFAULT_KEYS: Readonly<Record<ActionId, readonly string[]>> = {
  toolCable:    ['1'],
  toolInverter: ['2'],
  toolDelay:    ['3'],
  toolErase:    ['e'],
  toolSelect:   ['s'],
  play:         ['space'],
  step:         ['.', 'arrowright'],
  undo:         ['ctrl+z'],
  redo:         ['ctrl+y', 'ctrl+shift+z'],
  copy:         ['ctrl+c'],
  cut:          ['ctrl+x'],
  paste:        ['ctrl+v'],
  duplicate:    ['ctrl+d'],
  rotateCw:     ['r'],
  rotateCcw:    ['shift+r'],
  flipH:        ['f'],
  flipV:        ['shift+f'],
  deleteSel:    ['delete', 'backspace'],
};

/** Feste Tasten, die nicht belegt werden dürfen (Escape/Enter/Tab/Pfeile haben feste Aufgaben). */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'escape', 'enter', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'altgraph', 'capslock', 'os']);

/** Taste aus event.key (ohne Modifikatoren), oder null für reine Modifikatortasten. */
function keyToken(key: string): string | null {
  const k = key.toLowerCase();
  if (MODIFIER_KEYS.has(k)) return null;
  if (key === ' ') return 'space';
  if (key === '+') return 'plus';
  return k;
}

/** Kombination aus einem Tastaturereignis; null, wenn nur eine Modifikatortaste gedrückt ist. */
export function comboFromEvent(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string | null {
  const k = keyToken(e.key);
  if (k === null) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(k);
  return parts.join('+');
}

/** Prüft eine gespeicherte Kombination; liefert die Normalform oder null. */
export function normalizeCombo(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 40) return null;
  const parts = raw.toLowerCase().split('+');
  const key = parts.pop();
  if (!key || MODIFIER_KEYS.has(key)) return null;
  const mods = new Set(parts);
  for (const m of mods) if (m !== 'ctrl' && m !== 'alt' && m !== 'shift') return null;
  const out: string[] = [];
  if (mods.has('ctrl')) out.push('ctrl');
  if (mods.has('alt')) out.push('alt');
  if (mods.has('shift')) out.push('shift');
  out.push(key);
  return out.join('+');
}

/** Taste einer Kombination (letzter Teil). */
export function keyOf(combo: string): string {
  return combo.split('+').pop() ?? combo;
}

export function isReservedCombo(combo: string): boolean {
  return RESERVED_KEYS.has(keyOf(combo));
}

export type KeyLang = 'de' | 'en';

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = nav.userAgentData?.platform ?? navigator.platform ?? '';
  // iPadOS meldet sich teils als "MacIntel" — mit Touch-Punkten ist es ein iPad, das Cmd nutzt wie ein Mac
  return /mac|iphone|ipad|ipod/i.test(p);
}

const KEY_NAMES: Record<KeyLang, Record<string, string>> = {
  de: { space: 'Leertaste', delete: 'Entf', backspace: '⌫', enter: 'Enter', escape: 'Esc', plus: '+',
        arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓' },
  en: { space: 'Space', delete: 'Del', backspace: '⌫', enter: 'Enter', escape: 'Esc', plus: '+',
        arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓' },
};
const COMPACT_NAMES: Record<string, string> = {
  space: '␣', delete: '⌦', backspace: '⌫', enter: '↵', escape: 'Esc', plus: '+',
  arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓',
};

/**
 * Anzeigetext einer Kombination. Lang: "Strg+Umschalt+Z" / "Ctrl+Shift+Z",
 * auf Apple-Geräten "⌘⇧Z". Kompakt (für kleine Marken an Knöpfen): "⌃⇧Z" bzw. "⌘⇧Z".
 */
export function formatCombo(combo: string, lang: KeyLang, opts: { compact?: boolean; apple?: boolean } = {}): string {
  const apple = opts.apple ?? isApplePlatform();
  const parts = combo.split('+');
  // Ein "+" als Taste steht als "plus" im String, das Zerlegen ist also eindeutig
  const key = parts.pop() ?? '';
  const mods = new Set(parts);
  const keyText = opts.compact
    ? (COMPACT_NAMES[key] ?? key.toUpperCase())
    : (KEY_NAMES[lang][key] ?? (key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1)));

  if (apple || opts.compact) {
    const sym: string[] = [];
    if (mods.has('ctrl')) sym.push(apple ? '⌘' : '⌃');
    if (mods.has('alt')) sym.push('⌥');
    if (mods.has('shift')) sym.push('⇧');
    return sym.join('') + keyText;
  }
  const out: string[] = [];
  if (mods.has('ctrl')) out.push(lang === 'de' ? 'Strg' : 'Ctrl');
  if (mods.has('alt')) out.push('Alt');
  if (mods.has('shift')) out.push(lang === 'de' ? 'Umschalt' : 'Shift');
  out.push(keyText);
  return out.join('+');
}

/** Wirksame Belegung (Standard + Änderungen) → Kombination ⇒ Aktion. */
export function buildLookup(bindings: Readonly<Record<ActionId, readonly string[]>>): Map<string, ActionId> {
  const m = new Map<string, ActionId>();
  for (const id of ACTION_IDS) for (const c of bindings[id]) if (!m.has(c)) m.set(c, id);
  return m;
}
