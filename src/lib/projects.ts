/**
 * Projekte im Browser-Speicher (localStorage). Reine Funktionen, kein React,
 * kein Store.
 *
 * Schlüssel:
 *   u3.projects        Verzeichnis  { v:1, items: ProjectMeta[] }
 *   u3.project.<id>    ein Projekt im .u3-Format (serialize())
 *   u3.autosave        Arbeitsstand { v:1, currentId, t, file }
 *
 * Jeder Zugriff ist in try/catch: ist der Speicher gesperrt (Privates Fenster,
 * Cookies/Websitedaten blockiert) oder voll, melden die Schreibfunktionen
 * false statt zu werfen, und die App läuft ohne Speicher weiter.
 */
import type { Grid } from '../simulation/types';

export interface ProjectMeta {
  id: string;
  name: string;
  /** Zeitpunkt der letzten Speicherung (ms seit 1970) */
  updated: number;
  cells: number;
}

const INDEX_KEY = 'u3.projects';
const PROJECT_PREFIX = 'u3.project.';
const AUTOSAVE_KEY = 'u3.autosave';

export const MAX_NAME_LENGTH = 80;

function readJSON(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch { return null; }
}

function write(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignorieren */ }
}

export function newId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${rnd}`;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** Verzeichnis lesen — ungültige Einträge werden verworfen. */
export function readIndex(): ProjectMeta[] {
  const raw = readJSON(INDEX_KEY) as { items?: unknown } | null;
  if (!raw || !Array.isArray(raw.items)) return [];
  const items: ProjectMeta[] = [];
  for (const e of raw.items) {
    if (typeof e !== 'object' || e === null) continue;
    const m = e as Partial<ProjectMeta>;
    if (typeof m.id !== 'string' || typeof m.name !== 'string') continue;
    items.push({
      id: m.id, name: m.name,
      updated: typeof m.updated === 'number' ? m.updated : 0,
      cells: typeof m.cells === 'number' ? m.cells : 0,
    });
  }
  return items.sort((a, b) => b.updated - a.updated);
}

function writeIndex(items: ProjectMeta[]): boolean {
  return write(INDEX_KEY, JSON.stringify({ v: 1, items }));
}

export function readProjectFile(id: string): string | null {
  try { return localStorage.getItem(PROJECT_PREFIX + id); } catch { return null; }
}

/** Projekt speichern (neu oder überschreiben) und ins Verzeichnis eintragen. */
export function writeProject(meta: ProjectMeta, file: string): boolean {
  const index = readIndex().filter(p => p.id !== meta.id);
  index.push(meta);
  // Erst die Daten, dann das Verzeichnis: bricht das Schreiben dazwischen ab,
  // bleibt höchstens eine Datei ohne Eintrag zurück, nie ein Eintrag ohne Datei.
  if (!write(PROJECT_PREFIX + meta.id, file)) return false;
  if (!writeIndex(index)) { remove(PROJECT_PREFIX + meta.id); return false; }
  return true;
}

export function deleteProjectData(id: string): boolean {
  remove(PROJECT_PREFIX + id);
  return writeIndex(readIndex().filter(p => p.id !== id));
}

export function renameProjectData(id: string, name: string): boolean {
  const index = readIndex().map(p => (p.id === id ? { ...p, name } : p));
  return writeIndex(index);
}

// ── Arbeitsstand (Autosave) ──────────────────────────────────────────
export interface Autosave {
  currentId: string | null;
  t: number;
  file: string;
}

export function readAutosave(): Autosave | null {
  const raw = readJSON(AUTOSAVE_KEY) as Partial<Autosave> | null;
  if (!raw || typeof raw.file !== 'string') return null;
  return {
    currentId: typeof raw.currentId === 'string' ? raw.currentId : null,
    t: typeof raw.t === 'number' ? raw.t : 0,
    file: raw.file,
  };
}

export function writeAutosave(a: Autosave): boolean {
  return write(AUTOSAVE_KEY, JSON.stringify({ v: 1, ...a }));
}

export function clearAutosave(): void {
  remove(AUTOSAVE_KEY);
}

// ── Änderungserkennung ───────────────────────────────────────────────
/**
 * Kurzer Fingerabdruck des Zell-AUFBAUS (Position, Typ, Force). Der Zustand
 * (an/aus) zählt bewusst nicht: eine laufende Simulation macht ein Projekt
 * nicht "geändert". Unabhängig von der Reihenfolge der Map.
 */
export function layoutSignature(grid: Grid): string {
  let h = 0;
  for (const [k, c] of grid) {
    const s = `${k}|${c.type}|${c.forced ? 1 : 0}`;
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    h ^= x;
  }
  return `${grid.size}:${(h >>> 0).toString(36)}`;
}
