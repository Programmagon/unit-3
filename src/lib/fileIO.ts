/**
 * Browser-Datei-I/O — generalisiert aus App.tsx extrahiert (Schritt 5b,
 * Punkt 6), damit sowohl Grid-Dateien (.u3) als auch Selektions-Dateien
 * (.u3sel) dieselben Speichern/Laden-Mechanismen nutzen können, statt sie
 * pro Dateityp zu duplizieren.
 */

/**
 * Speichert `content` als Datei — File System Access API, sonst
 * <a download>-Fallback (Firefox, Safari, Mobile).
 *
 * @param description Anzeigename im Save-Dialog-Dateityp-Filter (z. B. "Unit-3 Datei").
 * @param accept MIME-Type → Dateiendungen, z. B. { 'application/json': ['.u3'] }.
 */
export async function saveToFile(
  content: string,
  filename: string,
  description: string,
  accept: Record<string, string[]>,
): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (e) {
      // Nutzer hat den Save-Dialog abgebrochen → kein Fehler, einfach nichts tun
      if (e instanceof DOMException && e.name === 'AbortError') return;
      throw e;
    }
  }
  // Fallback: Firefox, Safari, Mobile — kein Speicherort wählbar, direkter Download
  const mimeType = Object.keys(accept)[0] ?? 'application/json';
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Öffnet einen Datei-Dialog und liest die gewählte Datei als Text.
 * @param accept z. B. ".u3,.json" oder ".u3sel".
 */
export function loadFromFile(accept: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('Keine Datei gewählt')); return; }
      file.text().then(resolve).catch(reject);
    };
    // Bugfix: ohne dies löst das Promise bei einem abgebrochenen Datei-Dialog
    // NIE auf — 'onchange' feuert nur bei tatsächlicher Dateiauswahl, nicht
    // bei "Abbrechen". Jeder Aufrufer hängt dann unsichtbar in einem nie
    // erfüllten await fest. Der 'cancel'-Event ist in aktuellen Chromium- und
    // Firefox-Versionen unterstützt; in älteren Browsern ohne Unterstützung
    // bleibt das Verhalten wie zuvor (kein Regressions-Risiko).
    input.addEventListener('cancel', () => reject(new Error('Dateiauswahl abgebrochen')));
    input.click();
  });
}
