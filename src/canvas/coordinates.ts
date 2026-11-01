export interface Camera { x: number; y: number; zoom: number; }
/** Pixel pro Zelle. Bei 1 passen auf ein 2048 px breites iPad rund 2000 Zellen. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 120;
/**
 * Unterhalb davon ist die Ansicht eine reine Übersicht: Die Platzier-Werkzeuge
 * (Kabel, Umkehrer, Verzögerer, Löschen, Power) sind aus, Ziehen verschiebt die
 * Ansicht. Zellen von wenigen Pixeln trifft man nicht zuverlässig. Das war
 * früher der kleinste Zoom, die Bearbeitung ändert sich also nicht.
 */
export const EDIT_MIN_ZOOM = 6;
export function clampZoom(z: number): number {
  return Number.isFinite(z) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) : 36;
}
export function worldToScreen(wx: number, wy: number, cam: Camera): [number, number] {
  return [(wx - cam.x) * cam.zoom, (wy - cam.y) * cam.zoom];
}
export function screenToWorld(sx: number, sy: number, cam: Camera): [number, number] {
  return [sx / cam.zoom + cam.x, sy / cam.zoom + cam.y];
}
export function clientToCanvas(clientX: number, clientY: number, canvas: HTMLCanvasElement): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}
export function getCellAt(clientX: number, clientY: number, canvas: HTMLCanvasElement, cam: Camera): [number, number] {
  const [sx, sy] = clientToCanvas(clientX, clientY, canvas);
  const [wx, wy] = screenToWorld(sx, sy, cam);
  return [Math.floor(wx), Math.floor(wy)];
}
export function zoomAtPoint(cam: Camera, factor: number, focalSx: number, focalSy: number): void {
  const [wx, wy] = screenToWorld(focalSx, focalSy, cam);
  cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  cam.x = wx - focalSx / cam.zoom;
  cam.y = wy - focalSy / cam.zoom;
}
