import { create } from 'zustand';
import type { Tool } from '../canvas/input';

// Kamera lebt jetzt als useRef in Canvas.tsx (direkte Mutation, kein React-Overhead).
// uiStore verwaltet nur noch das aktive Werkzeug.

interface UIStore {
  /** null = kein Werkzeug aktiv — dann pannt jede Eingabe (siehe canvas/input.ts shouldPan). */
  tool:    Tool | null;
  setTool: (t: Tool | null) => void;
}

export const useUIStore = create<UIStore>(set => ({
  tool:    'cable',
  setTool: tool => set({ tool }),
}));
