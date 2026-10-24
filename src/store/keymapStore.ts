/**
 * Eigene Tastenkürzel + Tastaturhinweise.
 *
 * Gespeichert werden nur geänderte Aktionen (u3.keys, wie bei den Einstellungen).
 * Ein leeres Array = Aktion bewusst ohne Taste.
 *
 * Tastaturhinweise (Kürzel an den Knöpfen) erscheinen nach der Einstellung
 * keyHints (settingsStore): an / aus / automatisch. "Automatisch" heißt: mit
 * Maus-Geräten immer, auf Touch-Geräten (iPad) sobald eine Hardware-Tastatur
 * erkannt wurde, also die erste Taste außerhalb eines Eingabefelds gedrückt
 * wird. Das Ergebnis steht als data-keyhints="on|off" am <html>-Element (CSS).
 */
import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import {
  ACTION_IDS, DEFAULT_KEYS, buildLookup, normalizeCombo, isReservedCombo,
  type ActionId,
} from '../lib/keymap';

export type Bindings = Record<ActionId, readonly string[]>;
type KeyOverrides = Partial<Record<ActionId, string[]>>;

const KEY = 'u3.keys';

function sanitize(raw: unknown): KeyOverrides {
  const o: KeyOverrides = {};
  if (typeof raw !== 'object' || raw === null) return o;
  const r = raw as Record<string, unknown>;
  for (const id of ACTION_IDS) {
    const v = r[id];
    if (!Array.isArray(v)) continue;
    const combos = v.map(normalizeCombo).filter((c): c is string => c !== null && !isReservedCombo(c)).slice(0, 3);
    o[id] = combos;
  }
  return o;
}

function load(): KeyOverrides {
  try {
    const text = localStorage.getItem(KEY);
    return text ? sanitize((JSON.parse(text) as { o?: unknown }).o) : {};
  } catch { return {}; }
}

function save(o: KeyOverrides): void {
  try {
    if (Object.keys(o).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ v: 1, o }));
  } catch { /* Speicher gesperrt: gilt nur für diese Sitzung */ }
}

function compute(o: KeyOverrides): Bindings {
  const b = {} as Record<ActionId, readonly string[]>;
  for (const id of ACTION_IDS) b[id] = o[id] ?? DEFAULT_KEYS[id];
  return b;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export type BindResult =
  | { ok: true }
  | { ok: false; reason: 'reserved' }
  | { ok: false; reason: 'conflict'; other: ActionId };

interface KeymapState {
  overrides: KeyOverrides;
  bindings: Bindings;
  lookup: Map<string, ActionId>;
  /** Aktion, für die gerade eine neue Taste aufgenommen wird */
  capturing: ActionId | null;
  /** Hardware-Tastatur erkannt (nicht gespeichert) */
  hwKeyboard: boolean;
  setCapturing: (a: ActionId | null) => void;
  /** Belegt die Aktion neu (ersetzt alle ihre Tasten). Belegte Kombinationen werden abgelehnt. */
  setBinding: (action: ActionId, combo: string) => BindResult;
  resetBinding: (action: ActionId) => void;
  resetAll: () => void;
  setHwKeyboard: () => void;
}

function detectInitialHw(): boolean {
  try { return window.matchMedia('(pointer: fine)').matches; } catch { return false; }
}

export const useKeymapStore = create<KeymapState>((set, get) => {
  const overrides = load();
  const apply = (o: KeyOverrides) => {
    const bindings = compute(o);
    set({ overrides: o, bindings, lookup: buildLookup(bindings) });
  };
  const initial = compute(overrides);
  return {
    overrides,
    bindings: initial,
    lookup: buildLookup(initial),
    capturing: null,
    hwKeyboard: detectInitialHw(),
    setCapturing: a => set({ capturing: a }),
    setBinding: (action, combo) => {
      if (isReservedCombo(combo)) return { ok: false, reason: 'reserved' };
      const other = get().lookup.get(combo);
      if (other !== undefined && other !== action) return { ok: false, reason: 'conflict', other };
      const o: KeyOverrides = { ...get().overrides };
      if (sameList([combo], DEFAULT_KEYS[action])) delete o[action];
      else o[action] = [combo];
      apply(o);
      return { ok: true };
    },
    resetBinding: action => {
      const o = { ...get().overrides };
      delete o[action];
      apply(o);
    },
    resetAll: () => apply({}),
    setHwKeyboard: () => { if (!get().hwKeyboard) set({ hwKeyboard: true }); },
  };
});

useKeymapStore.subscribe((s, prev) => {
  if (s.overrides !== prev.overrides) save(s.overrides);
});

// ── Tastaturhinweise ─────────────────────────────────────────────────
function applyHints(): void {
  if (typeof document === 'undefined') return;
  const pref = useSettingsStore.getState().settings.keyHints;
  const hw = useKeymapStore.getState().hwKeyboard;
  const on = pref === 'on' || (pref === 'auto' && hw);
  document.documentElement.dataset.keyhints = on ? 'on' : 'off';
}
applyHints();
useSettingsStore.subscribe((s, prev) => { if (s.settings.keyHints !== prev.settings.keyHints) applyHints(); });
useKeymapStore.subscribe((s, prev) => { if (s.hwKeyboard !== prev.hwKeyboard) applyHints(); });

if (typeof window !== 'undefined') {
  // Erste echte Taste außerhalb von Eingabefeldern = Hardware-Tastatur (die iPad-Bildschirmtastatur tippt nur in Felder)
  const onFirstKey = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    useKeymapStore.getState().setHwKeyboard();
    window.removeEventListener('keydown', onFirstKey, true);
  };
  window.addEventListener('keydown', onFirstKey, true);
}
