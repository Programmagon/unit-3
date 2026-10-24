/**
 * Deutsche Texte (Referenzsprache — die Schlüssel stammen aus dieser Datei,
 * en.ts muss alle haben, sonst meldet TypeScript einen Fehler).
 *
 * Platzhalter stehen in {geschweiften Klammern}. Tastenkürzel stehen in
 * eckigen Klammern direkt im Text, damit Tooltips und Beschriftungen sie
 * pro Sprache richtig benennen (Strg/Ctrl, Umschalt/Shift, Entf/Del).
 */
export const de = {
  // ── Allgemein ──────────────────────────────────────────────────────
  'common.on': 'An',
  'common.off': 'Aus',
  'common.reset': 'Zurücksetzen',
  'common.cancel': 'Abbrechen',
  'common.ok': 'OK',

  // Tastennamen
  'key.ctrl': 'Strg',
  'key.shift': 'Umschalt',
  'key.del': 'Entf',
  'key.space': 'Leertaste',
  'key.alt': 'Alt',

  // ── Tastenkürzel ───────────────────────────────────────────────────
  'set.sec.keys': 'Tastenkürzel',
  'set.keyHints': 'Tastaturhinweise',
  'set.keyHints.auto': 'Automatisch',
  'set.keyHints.on': 'An',
  'set.keyHints.off': 'Aus',
  'set.keyHintsHint':
    'Zeigt das Kürzel als kleine Marke am Knopf. Automatisch: mit Maus immer, auf dem Tablet sobald eine ' +
    'Tastatur erkannt wird (erste gedrückte Taste).',
  'keys.group.tools': 'Werkzeuge',
  'keys.group.sim': 'Simulation',
  'keys.group.edit': 'Bearbeiten',
  'keys.group.selection': 'Auswahl',
  'keys.change': 'Ändern',
  'keys.changeAria': 'Taste für „{action}“ ändern',
  'keys.press': 'Taste drücken …',
  'keys.none': 'Keine',
  'keys.resetOne': 'Standard wiederherstellen: {action}',
  'keys.hint':
    'Auf „Ändern“ tippen und die neue Taste oder Tastenkombination drücken. Esc bricht ab. ' +
    'Eine Tastatur ist erforderlich. Kürzel des Browsers (z. B. Strg+W) lassen sich nicht überschreiben.',
  'keys.reserved': '„{key}“ ist reserviert (Esc, Enter, Tab und Pfeiltasten haben feste Aufgaben).',
  'keys.conflict': '„{key}“ ist bereits „{action}“ zugewiesen. Ändere zuerst jene Belegung.',
  'keys.fixed': 'Fest belegt: Enter bestätigt, Esc bricht ab, Pfeiltasten verschieben die Auswahl.',


  // ── Werkzeuge ──────────────────────────────────────────────────────
  'tool.cable': 'Kabel',
  'tool.inverter': 'Umkehrer',
  'tool.delay': 'Verzögerer',
  'tool.delete': 'Löschen',
  'tool.select': 'Auswählen',

  // ── Leiste ─────────────────────────────────────────────────────────
  'bar.undo': 'Rückgängig',
  'bar.undoTitle': 'Rückgängig',
  'bar.redo': 'Wiederholen',
  'bar.redoTitle': 'Wiederholen',
  'bar.step': 'Schritt',
  'bar.stepTitle': 'Einen Simulationsschritt ausführen',
  'bar.play': 'Start',
  'bar.pause': 'Pause',
  'bar.playTitle': 'Simulation starten',
  'bar.pauseTitle': 'Simulation anhalten',
  'bar.clear': 'Leeren',
  'bar.clearTitle': 'Alle Zellen entfernen und die Simulation zurücksetzen',
  'bar.save': 'Speichern',
  'bar.saveTitle': 'Als Datei speichern (.u3)',
  'bar.open': 'Öffnen',
  'bar.openTitle': 'Datei öffnen (.u3, .json)',
  'bar.import': 'Import',
  'bar.importTitle': 'Selektion importieren (.u3sel)',
  'bar.projects': 'Projekte',
  'bar.projectsTitle': 'Im Browser gespeicherte Projekte',
  'bar.speed': 'Geschwindigkeit in Hertz',
  'theme.auto': 'Automatisch',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'theme.toggle': 'Farbschema: {current} — Klicken für {next}',

  // ── Statusleiste ───────────────────────────────────────────────────
  'status.steps': 'Schritt',
  'status.cells': 'Zellen',
  'status.overlay': '{steps} Schritte · {cells} Zellen',
  'status.simError': 'Simulationsfehler',
  'hint.place':
    'Klicken: Zelle setzen · Erneut auf denselben Typ: ⊕ umschalten · Rechtsklick oder langes Drücken: Löschen · ' +
    'Alt+Ziehen: Ansicht verschieben · Mausrad oder Zwei-Finger-Geste: Zoom',
  'hint.placeSwap':
    'Klicken: Zelle setzen · Erneut auf denselben Typ: ⊕ umschalten (Touch: Zelle löschen) · Rechtsklick: Löschen · ' +
    'Langes Drücken: ⊕ umschalten · Alt+Ziehen: Ansicht verschieben · Mausrad oder Zwei-Finger-Geste: Zoom',
  'hint.select':
    'Ziehen: Bereich auswählen (ersetzt die vorherige Auswahl) · Auswahl ziehen: verschieben · ' +
    '{rotate}: drehen · {flip}: spiegeln · Pfeiltasten: um eine Zelle verschieben · ' +
    'Enter: bestätigen · Esc: abbrechen · {clip}: kopieren, ausschneiden, einfügen, duplizieren',

  // ── Fehler und Hinweise ────────────────────────────────────────────
  'err.simLoop': 'Kombinatorische Schleife ohne Verzögerer. Füge einen Verzögerer in die Schleife ein.',
  'err.unreadable': 'Die Datei konnte nicht gelesen werden.',
  'err.version': 'Nicht unterstützte Dateiversion: {v}.',
  'err.saveFile': 'Die Datei konnte nicht gespeichert werden.',
  'err.exportSelection': 'Die Selektion konnte nicht exportiert werden.',
  'err.noCells': 'Die Datei enthält keine gültigen Zellen. Möglicherweise wurde das falsche Dateiformat gewählt.',

  // ── Selektion ──────────────────────────────────────────────────────
  'sel.confirm': 'Bestätigen',
  'sel.confirmTitle': 'Bestätigen',
  'sel.cancel': 'Abbrechen',
  'sel.cancelTitle': 'Abbrechen',
  'sel.copy': 'Kopieren',
  'sel.copyTitle': 'Kopieren',
  'sel.cut': 'Ausschneiden',
  'sel.cutTitle': 'Ausschneiden',
  'sel.paste': 'Einfügen',
  'sel.pasteTitle': 'Einfügen',
  'sel.duplicate': 'Duplizieren',
  'sel.duplicateTitle': 'Duplizieren',
  'sel.rotateCw': 'Drehen +90°',
  'sel.rotateCwTitle': 'Im Uhrzeigersinn drehen',
  'sel.rotateCcw': 'Drehen −90°',
  'sel.rotateCcwTitle': 'Gegen den Uhrzeigersinn drehen',
  'sel.flipH': 'Spiegeln ↔',
  'sel.flipHTitle': 'Horizontal spiegeln',
  'sel.flipV': 'Spiegeln ↕',
  'sel.flipVTitle': 'Vertikal spiegeln',
  'sel.export': 'Exportieren',
  'sel.exportTitle': 'Selektion exportieren (.u3sel)',
  'sel.delete': 'Löschen',
  'sel.deleteTitle': 'Löschen',

  // ── Einstellungen ──────────────────────────────────────────────────
  'set.title': 'Einstellungen',
  'set.open': 'Einstellungen',
  'set.close': 'Einstellungen schließen',
  'set.closeTitle': 'Schließen [Esc]',
  'set.resetSectionTitle': '{section}: auf Standard zurücksetzen',
  'set.resetSectionAria': '{section} zurücksetzen',
  'set.resetAll': 'Alle Einstellungen zurücksetzen',

  'set.sec.look': 'Look',
  'set.sec.appearance': 'Darstellung',
  'set.sec.controls': 'Bedienung',
  'set.sec.general': 'Allgemein',

  'set.lookHint':
    'Wähle einen Gesamtstil. Die Feinabstimmung darunter passt einzelne Werte an; ein neuer Look ersetzt sie.',
  'set.lookTweaked': 'Mit eigenen Anpassungen',
  'set.scheme': 'Farbschema',
  'set.schemeAutoTitle': 'Folgt der Systemeinstellung',
  'set.glyph': 'Symbole',
  'set.glyph.none': 'Keine',
  'set.glyph.sel': 'Umk./Verz.',
  'set.glyph.selTitle': 'Nur Umkehrer und Verzögerer',
  'set.glyph.line': 'Alle',
  'set.glyph.dot': 'Punkt',
  'set.glow': 'Leuchten',
  'set.glowHint': 'Wirkt nur im dunklen Farbschema.',
  'set.grid': 'Raster',
  'set.offTone': 'Aus-Farben',
  'set.offTone.original': 'Original',
  'set.offTone.originalTitle': 'Feste Farben aus dem Theme',
  'set.offToneHint':
    'Farbe ausgeschalteter Zellen im dunklen Farbschema. C und D sind kräftiger, E und F werden mit dem ' +
    'Hintergrund gemischt. Die Namen erscheinen als Tooltip.',

  'set.straight': 'Gerade Linie',
  'set.straight.auto': 'Automatisch',
  'set.straight.off': 'Aus',
  'set.straight.shift': 'Mit Umschalt',
  'set.straight.shiftTitle': 'Nur bei gehaltener Umschalttaste (Tastatur erforderlich)',
  'set.straightHint':
    'Automatisch: Beim Ziehen rastet die Richtung nach zwei Zellen auf waagerecht oder senkrecht ein. ' +
    '„Mit Umschalt“ erfordert eine Tastatur. Beim Löschen gibt es keine Richtungssperre.',
  'set.tap': 'Tippen auf eine Zelle (Touch/Stift)',
  'set.tap.power': 'Dauer-AN (⊕)',
  'set.tap.delete': 'Löschen',
  'set.tapHintPower':
    'Ein Tipp auf eine Zelle desselben Typs schaltet ⊕ (dauerhaft an) um. Langes Drücken löscht, auch beim Weiterziehen.',
  'set.tapHintDelete':
    'Ein Tipp auf eine Zelle desselben Typs löscht sie. Langes Drücken schaltet ⊕ (dauerhaft an) um. ' +
    'Zum Löschen per Wischen dient das Werkzeug „Löschen“.',

  'set.lang': 'Sprache',
  'set.lang.auto': 'Automatisch',
  'set.feedback': 'Feedback',
  'set.feedbackBtn': 'Feedback senden',
  'set.feedbackHint':
    'Kopiert einen Bericht mit Look, Einstellungen und Gerät in die Zwischenablage. ' +
    'Ergänze dein Feedback und sende es an das Entwicklerteam.',
  'set.feedbackCopied': 'In die Zwischenablage kopiert.',
  'set.feedbackFailed': 'Kopieren nicht möglich. Bitte den Text manuell kopieren.',
  'set.version': 'Version {v}',

  // ── Looks ──────────────────────────────────────────────────────────
  'look.standard.name': 'Standard',
  'look.standard.desc': 'Verschmolzene Zellen, Symbole bei Umkehrern und Verzögerern.',
  'look.calm.name': 'Ruhig',
  'look.calm.desc': 'Verschmolzen, ohne Symbole und ohne Leuchten.',
  'look.seam.name': 'Fugen',
  'look.seam.desc': 'Feine Fuge zwischen den Zellen, alle Symbole.',
  'look.tiles.name': 'Kacheln',
  'look.tiles.desc': 'Einzelne, abgerundete Zellen mit Abstand.',
  'look.sharp.name': 'Eckig',
  'look.sharp.desc': 'Scharfkantig, ohne Kontur, Aus-Farben mit dem Hintergrund gemischt.',
  'look.classic.name': 'Klassisch',
  'look.classic.desc': 'Das frühere Design: Fugen, kräftige Kontur, dunkle Aus-Farben.',

  // ── Projekte ───────────────────────────────────────────────────────
  'proj.title': 'Projekte',
  'proj.close': 'Projekte schließen',
  'proj.current': 'Aktuelles Projekt',
  'proj.draft': 'Entwurf (nicht als Projekt gespeichert)',
  'proj.dirty': 'Ungespeicherte Änderungen',
  'proj.clean': 'Alle Änderungen gespeichert',
  'proj.save': 'Speichern',
  'proj.saveAs': 'Speichern unter …',
  'proj.new': 'Neues Projekt',
  'proj.name': 'Projektname',
  'proj.defaultName': 'Projekt {date}',
  'proj.autosave': 'Automatisch speichern',
  'proj.autosaveHint':
    'Änderungen werden automatisch im Browser gespeichert (localStorage) und beim nächsten Start wiederhergestellt. ' +
    'Die Daten verbleiben auf diesem Gerät.',
  'proj.list': 'Gespeicherte Projekte',
  'proj.empty': 'Noch keine Projekte gespeichert.',
  'proj.meta': '{cells} Zellen · {date}',
  'proj.open': 'Öffnen',
  'proj.openAria': 'Projekt „{name}“ öffnen',
  'proj.rename': 'Umbenennen',
  'proj.duplicate': 'Duplizieren',
  'proj.delete': 'Löschen',
  'proj.copyName': '{name} (Kopie)',
  'proj.confirmDelete': 'Projekt „{name}“ endgültig löschen?',
  'proj.confirmNew': 'Es gibt ungespeicherte Änderungen. Trotzdem ein neues Projekt beginnen?',
  'proj.confirmOpen': 'Ungespeicherte Änderungen gehen verloren. Das Projekt trotzdem öffnen?',
  'proj.storageFull':
    'Der Browser-Speicher ist voll oder nicht verfügbar. Lösche nicht benötigte Projekte oder sichere das Projekt als Datei.',
  'proj.backupHint':
    'Browserdaten können vom System oder durch Löschen des Verlaufs entfernt werden. ' +
    'Sichere wichtige Projekte zusätzlich als Datei („Speichern“ in der Leiste).',
} as const;

export type TKey = keyof typeof de;
