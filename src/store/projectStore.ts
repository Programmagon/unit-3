/**
 * Projekte im Browser (localStorage) + Autosave.
 *
 * Ein Projekt ist ein Eintrag in lib/projects.ts. "Aktuelles Projekt" ist das,
 * was zuletzt geöffnet oder gespeichert wurde; ohne aktuelles Projekt ist der
 * Arbeitsstand ein Entwurf. Geändert-Anzeige: Fingerabdruck des Zell-Aufbaus
 * gegen den gespeicherten Stand (an/aus-Zustände zählen nicht).
 *
 * Autosave schreibt den Arbeitsstand (Grid + Kamera) kurz nach jeder Änderung
 * nach u3.autosave und beim Verlassen der Seite; beim Start stellt
 * restoreSession() ihn wieder her. Das ersetzt kein Projekt: "Speichern"
 * schreibt den Stand erst ins Projektverzeichnis.
 *
 * Die Kamera lebt im Canvas (Ref); App.tsx meldet sie über bindCamera() an.
 */
import { create } from 'zustand';
import { useGridStore } from './gridStore';
import { useSelectionStore } from './selectionStore';
import { useSettingsStore } from './settingsStore';
import { serialize, deserialize, type Camera } from '../lib/serializer';
import {
  type ProjectMeta, cleanName, clearAutosave, deleteProjectData, layoutSignature, newId,
  readAutosave, readIndex, readProjectFile, renameProjectData, writeAutosave, writeProject,
} from '../lib/projects';
import { t, currentLang } from '../i18n';

interface CameraAccess { get: () => Camera | null; set: (c: Camera) => void }
let cameraAccess: CameraAccess | null = null;

/** Canvas meldet hier an, damit Projekte die Kamera mitspeichern und wiederherstellen können. */
export function bindCamera(access: CameraAccess | null): void {
  cameraAccess = access;
}

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 32 };

function currentCamera(): Camera {
  return cameraAccess?.get() ?? DEFAULT_CAMERA;
}

/** Datum im Format der Sprache, für Listen und Standardnamen. */
export function formatDate(ms: number, withTime: boolean): string {
  const loc = currentLang() === 'de' ? 'de-DE' : 'en-GB';
  try {
    return new Date(ms).toLocaleString(loc, withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' });
  } catch { return new Date(ms).toISOString().slice(0, 10); }
}

interface ProjectState {
  projects: ProjectMeta[];
  currentId: string | null;
  /** Fingerabdruck des gespeicherten Stands des aktuellen Projekts (null = Entwurf) */
  savedSig: string | null;
  dirty: boolean;
  /** Letzter Schreibversuch ist gescheitert (Speicher voll/gesperrt) */
  storageFailed: boolean;

  refreshDirty: () => void;
  /** Speichert in das aktuelle Projekt, oder legt eines an (Entwurf). */
  save: (name: string) => boolean;
  /** Speichert als neues Projekt. */
  saveAs: (name: string) => boolean;
  open: (id: string) => boolean;
  /** Leeres Grid, kein aktuelles Projekt. */
  newProject: () => void;
  /** Der Arbeitsstand gehört zu keinem Projekt mehr (z. B. nach dem Öffnen einer Datei). */
  detach: () => void;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
}

/** Schwebende Selektion gehört zum Stand: erst einsetzen, dann sichern (wie beim Datei-Speichern). */
function commitGridPrelude(): void {
  const sel = useSelectionStore.getState();
  if (sel.selection.status === 'floating') sel.commitFloating();
}

function fail(set: (p: Partial<ProjectState>) => void): false {
  set({ storageFailed: true });
  alert(t('proj.storageFull'));
  return false;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const writeNew = (id: string, name: string): boolean => {
    commitGridPrelude();
    const grid = useGridStore.getState().grid;
    const file = serialize(grid, currentCamera());
    const meta: ProjectMeta = { id, name, updated: Date.now(), cells: grid.size };
    if (!writeProject(meta, file)) return fail(set);
    set({
      projects: readIndex(), currentId: id, savedSig: layoutSignature(grid),
      dirty: false, storageFailed: false,
    });
    return true;
  };

  const defaultName = () => t('proj.defaultName', { date: formatDate(Date.now(), true) });

  return {
    projects: readIndex(),
    currentId: null,
    savedSig: null,
    dirty: false,
    storageFailed: false,

    refreshDirty: () => {
      const { savedSig } = get();
      const grid = useGridStore.getState().grid;
      const dirty = savedSig === null ? grid.size > 0 : layoutSignature(grid) !== savedSig;
      if (dirty !== get().dirty) set({ dirty });
    },

    save: name => {
      const id = get().currentId ?? newId();
      const existing = get().projects.find(p => p.id === id);
      return writeNew(id, cleanName(name) || existing?.name || defaultName());
    },

    saveAs: name => writeNew(newId(), cleanName(name) || defaultName()),

    open: id => {
      const file = readProjectFile(id);
      if (file === null) { set({ projects: readIndex() }); return false; }
      try {
        const { grid, camera } = deserialize(file);
        useGridStore.getState().loadGrid(grid);
        cameraAccess?.set(camera);
        set({ currentId: id, savedSig: layoutSignature(grid), dirty: false });
        return true;
      } catch { return false; }
    },

    newProject: () => {
      useGridStore.getState().loadGrid(new Map());
      set({ currentId: null, savedSig: null, dirty: false });
    },

    detach: () => {
      set({ currentId: null, savedSig: null });
      get().refreshDirty();
    },

    rename: (id, name) => {
      const n = cleanName(name);
      if (!n) return;
      if (!renameProjectData(id, n)) { fail(set); return; }
      set({ projects: readIndex() });
    },

    duplicate: id => {
      const file = readProjectFile(id);
      const src = get().projects.find(p => p.id === id);
      if (file === null || !src) return;
      const meta: ProjectMeta = {
        id: newId(), name: t('proj.copyName', { name: src.name }), updated: Date.now(), cells: src.cells,
      };
      if (!writeProject(meta, file)) { fail(set); return; }
      set({ projects: readIndex() });
    },

    remove: id => {
      deleteProjectData(id);
      const wasCurrent = get().currentId === id;
      set({
        projects: readIndex(),
        ...(wasCurrent ? { currentId: null, savedSig: null } : {}),
      });
      get().refreshDirty();
    },
  };
});

// ── Autosave / Wiederherstellen ──────────────────────────────────────

/** Stellt den zuletzt gesicherten Arbeitsstand wieder her. Einmal beim Start aufrufen. */
export function restoreSession(): void {
  if (!useSettingsStore.getState().settings.autosave) return;
  const a = readAutosave();
  if (!a) return;
  try {
    const { grid, camera } = deserialize(a.file);
    if (grid.size === 0 && a.currentId === null) return;
    useGridStore.getState().loadGrid(grid);
    cameraAccess?.set(camera);
    // Stand des Projekts, zu dem der Arbeitsstand gehört (falls es noch existiert)
    const known = a.currentId !== null && readIndex().some(p => p.id === a.currentId);
    let savedSig: string | null = null;
    if (known && a.currentId) {
      const saved = readProjectFile(a.currentId);
      if (saved) { try { savedSig = layoutSignature(deserialize(saved).grid); } catch { /* Entwurf */ } }
    }
    useProjectStore.setState({ currentId: savedSig !== null ? a.currentId : null, savedSig });
    useProjectStore.getState().refreshDirty();
  } catch { /* kaputter Arbeitsstand: ignorieren, der nächste Autosave überschreibt ihn */ }
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function flushAutosave(): void {
  pendingTimer = null;
  if (!useSettingsStore.getState().settings.autosave) return;
  const grid = useGridStore.getState().grid;
  const { currentId } = useProjectStore.getState();
  if (grid.size === 0 && currentId === null) { clearAutosave(); return; }
  const ok = writeAutosave({ currentId, t: Date.now(), file: serialize(grid, currentCamera()) });
  if (!ok && !useProjectStore.getState().storageFailed) useProjectStore.setState({ storageFailed: true });
}

/** Startet die Beobachtung von Grid und Einstellungen. Einmal aufrufen; gibt die Aufräumfunktion zurück. */
export function startAutosave(): () => void {
  const schedule = () => {
    // Kein Zurücksetzen des Timers: bei laufender Simulation (Änderung pro Schritt) würde sonst nie gespeichert.
    if (pendingTimer === null) pendingTimer = setTimeout(flushAutosave, 800);
  };
  // Geändert-Anzeige zeitnah (kurz gebündelt); ein Simulationsschritt ändert nur den Zustand, nicht den Aufbau
  let dirtyTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleDirty = () => {
    if (dirtyTimer === null) dirtyTimer = setTimeout(() => {
      dirtyTimer = null;
      useProjectStore.getState().refreshDirty();
    }, 120);
  };
  const unsubGrid = useGridStore.subscribe((s, prev) => {
    if (s.grid !== prev.grid) { schedule(); scheduleDirty(); }
  });
  const unsubSet = useSettingsStore.subscribe((s, prev) => {
    if (s.settings.autosave === prev.settings.autosave) return;
    if (s.settings.autosave) flushAutosave(); else clearAutosave();
  });
  const onHide = () => { if (document.visibilityState === 'hidden') flushAutosave(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushAutosave);
  return () => {
    unsubGrid(); unsubSet();
    if (dirtyTimer !== null) clearTimeout(dirtyTimer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flushAutosave);
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  };
}
