/** English texts. Must provide every key of de.ts (checked by TypeScript). */
import type { TKey } from './de';

export const en: Record<TKey, string> = {
  // ── General ────────────────────────────────────────────────────────
  'common.on': 'On',
  'common.off': 'Off',
  'common.reset': 'Reset',
  'common.cancel': 'Cancel',
  'common.ok': 'OK',

  // Key names
  'key.ctrl': 'Ctrl',
  'key.shift': 'Shift',
  'key.del': 'Del',
  'key.space': 'Space',
  'key.alt': 'Alt',

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  'set.sec.keys': 'Keyboard shortcuts',
  'set.keyHints': 'Keyboard hints',
  'set.keyHints.auto': 'Automatic',
  'set.keyHints.on': 'On',
  'set.keyHints.off': 'Off',
  'set.keyHintsHint':
    'Shows the shortcut as a small badge on the button. Automatic: always with a mouse; on a tablet as soon ' +
    'as a keyboard is detected (first key pressed).',
  'keys.group.tools': 'Tools',
  'keys.group.sim': 'Simulation',
  'keys.group.edit': 'Edit',
  'keys.group.selection': 'Selection',
  'keys.change': 'Change',
  'keys.changeAria': 'Change key for “{action}”',
  'keys.press': 'Press a key …',
  'keys.none': 'None',
  'keys.resetOne': 'Restore default: {action}',
  'keys.hint':
    'Tap “Change” and press the new key or key combination. Esc cancels. ' +
    'A keyboard is required. Browser shortcuts (e.g. Ctrl+W) cannot be overridden.',
  'keys.reserved': '“{key}” is reserved (Esc, Enter, Tab and the arrow keys have fixed roles).',
  'keys.conflict': '“{key}” is already assigned to “{action}”. Change that assignment first.',
  'keys.fixed': 'Fixed: Enter confirms, Esc cancels, arrow keys move the selection.',


  // ── Tools ──────────────────────────────────────────────────────────
  'tool.cable': 'Cable',
  'tool.inverter': 'Inverter',
  'tool.delay': 'Delay',
  'tool.delete': 'Erase',
  'tool.select': 'Select',

  // ── Bar ────────────────────────────────────────────────────────────
  'bar.undo': 'Undo',
  'bar.undoTitle': 'Undo',
  'bar.redo': 'Redo',
  'bar.redoTitle': 'Redo',
  'bar.step': 'Step',
  'bar.stepTitle': 'Run one simulation step',
  'bar.play': 'Play',
  'bar.pause': 'Pause',
  'bar.playTitle': 'Start the simulation',
  'bar.pauseTitle': 'Pause the simulation',
  'bar.clear': 'Clear',
  'bar.clearTitle': 'Remove all cells and reset the simulation',
  'bar.save': 'Save',
  'bar.saveTitle': 'Save as file (.u3)',
  'bar.open': 'Open',
  'bar.openTitle': 'Open file (.u3, .json)',
  'bar.import': 'Import',
  'bar.importTitle': 'Import selection (.u3sel)',
  'bar.projects': 'Projects',
  'bar.projectsTitle': 'Projects stored in this browser',
  'bar.speed': 'Speed in hertz',
  'theme.auto': 'Automatic',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.toggle': 'Color scheme: {current} — click for {next}',

  // ── Status bar ─────────────────────────────────────────────────────
  'status.steps': 'Step',
  'status.cells': 'Cells',
  'status.overlay': '{steps} steps · {cells} cells',
  'status.simError': 'Simulation error',
  'hint.place':
    'Click: place a cell · Click the same type again: toggle ⊕ · Right-click or long press: erase · ' +
    'Alt+drag: pan · Mouse wheel or two-finger gesture: zoom',
  'hint.placeSwap':
    'Click: place a cell · Click the same type again: toggle ⊕ (touch: erase the cell) · Right-click: erase · ' +
    'Long press: toggle ⊕ · Alt+drag: pan · Mouse wheel or two-finger gesture: zoom',
  'hint.select':
    'Drag: select an area (replaces the previous selection) · Drag the selection: move · ' +
    '{rotate}: rotate · {flip}: flip · Arrow keys: move by one cell · ' +
    'Enter: confirm · Esc: cancel · {clip}: copy, cut, paste, duplicate',

  // ── Errors and notices ─────────────────────────────────────────────
  'err.simLoop': 'Combinational loop without a delay. Add a delay cell to the loop.',
  'err.unreadable': 'The file could not be read.',
  'err.version': 'Unsupported file version: {v}.',
  'err.saveFile': 'The file could not be saved.',
  'err.exportSelection': 'The selection could not be exported.',
  'err.noCells': 'The file contains no valid cells. You may have chosen the wrong file type.',

  // ── Selection ──────────────────────────────────────────────────────
  'sel.confirm': 'Confirm',
  'sel.confirmTitle': 'Confirm',
  'sel.cancel': 'Cancel',
  'sel.cancelTitle': 'Cancel',
  'sel.copy': 'Copy',
  'sel.copyTitle': 'Copy',
  'sel.cut': 'Cut',
  'sel.cutTitle': 'Cut',
  'sel.paste': 'Paste',
  'sel.pasteTitle': 'Paste',
  'sel.duplicate': 'Duplicate',
  'sel.duplicateTitle': 'Duplicate',
  'sel.rotateCw': 'Rotate +90°',
  'sel.rotateCwTitle': 'Rotate clockwise',
  'sel.rotateCcw': 'Rotate −90°',
  'sel.rotateCcwTitle': 'Rotate counterclockwise',
  'sel.flipH': 'Flip ↔',
  'sel.flipHTitle': 'Flip horizontally',
  'sel.flipV': 'Flip ↕',
  'sel.flipVTitle': 'Flip vertically',
  'sel.export': 'Export',
  'sel.exportTitle': 'Export selection (.u3sel)',
  'sel.delete': 'Delete',
  'sel.deleteTitle': 'Delete',

  // ── Settings ───────────────────────────────────────────────────────
  'set.title': 'Settings',
  'set.open': 'Settings',
  'set.close': 'Close settings',
  'set.closeTitle': 'Close [Esc]',
  'set.resetSectionTitle': '{section}: reset to defaults',
  'set.resetSectionAria': 'Reset {section}',
  'set.resetAll': 'Reset all settings',

  'set.sec.look': 'Look',
  'set.sec.appearance': 'Appearance',
  'set.sec.controls': 'Controls',
  'set.sec.general': 'General',

  'set.lookHint':
    'Pick an overall style. The fine-tuning below adjusts individual values; choosing a new look replaces it.',
  'set.lookTweaked': 'With custom adjustments',
  'set.scheme': 'Color scheme',
  'set.schemeAutoTitle': 'Follows the system setting',
  'set.glyph': 'Symbols',
  'set.glyph.none': 'None',
  'set.glyph.sel': 'Inv./Delay',
  'set.glyph.selTitle': 'Inverters and delays only',
  'set.glyph.line': 'All',
  'set.glyph.dot': 'Dot',
  'set.glow': 'Glow',
  'set.glowHint': 'Applies to the dark color scheme only.',
  'set.grid': 'Grid',
  'set.offTone': 'Off colors',
  'set.offTone.original': 'Original',
  'set.offTone.originalTitle': 'Fixed theme colors',
  'set.offToneHint':
    'Color of switched-off cells in the dark color scheme. C and D are more saturated; E and F are blended ' +
    'with the background. Names appear as tooltips.',

  'set.straight': 'Straight line',
  'set.straight.auto': 'Automatic',
  'set.straight.off': 'Off',
  'set.straight.shift': 'With Shift',
  'set.straight.shiftTitle': 'Only while Shift is held (keyboard required)',
  'set.straightHint':
    'Automatic: while dragging, the direction snaps to horizontal or vertical after two cells. ' +
    '“With Shift” requires a keyboard. Erasing is never constrained.',
  'set.tap': 'Tap on a cell (touch/pen)',
  'set.tap.power': 'Lock ON (⊕)',
  'set.tap.delete': 'Erase',
  'set.tapHintPower':
    'Tapping a cell of the same type toggles ⊕ (locked on). A long press erases, including while dragging.',
  'set.tapHintDelete':
    'Tapping a cell of the same type erases it. A long press toggles ⊕ (locked on). ' +
    'To erase by swiping, use the Erase tool.',

  'set.lang': 'Language',
  'set.lang.auto': 'Automatic',
  'set.feedback': 'Feedback',
  'set.feedbackBtn': 'Send feedback',
  'set.feedbackHint':
    'Copies a report with the look, settings and device to the clipboard. ' +
    'Add your feedback and send it to the development team.',
  'set.feedbackCopied': 'Copied to the clipboard.',
  'set.feedbackFailed': 'Copying is not possible. Please copy the text manually.',
  'set.version': 'Version {v}',

  // ── Looks ──────────────────────────────────────────────────────────
  'look.standard.name': 'Default',
  'look.standard.desc': 'Merged cells, symbols on inverters and delays.',
  'look.calm.name': 'Calm',
  'look.calm.desc': 'Merged, no symbols and no glow.',
  'look.seam.name': 'Seams',
  'look.seam.desc': 'Fine seam between cells, all symbols.',
  'look.tiles.name': 'Tiles',
  'look.tiles.desc': 'Separate rounded cells with spacing.',
  'look.sharp.name': 'Sharp',
  'look.sharp.desc': 'Square corners, no outline, off colors blended with the background.',
  'look.classic.name': 'Classic',
  'look.classic.desc': 'The previous design: seams, bold outline, dark off colors.',

  // ── Projects ───────────────────────────────────────────────────────
  'proj.title': 'Projects',
  'proj.close': 'Close projects',
  'proj.current': 'Current project',
  'proj.draft': 'Draft (not saved as a project)',
  'proj.dirty': 'Unsaved changes',
  'proj.clean': 'All changes saved',
  'proj.save': 'Save',
  'proj.saveAs': 'Save as …',
  'proj.new': 'New project',
  'proj.name': 'Project name',
  'proj.defaultName': 'Project {date}',
  'proj.autosave': 'Autosave',
  'proj.autosaveHint':
    'Changes are saved automatically in this browser (localStorage) and restored on the next start. ' +
    'The data stays on this device.',
  'proj.list': 'Saved projects',
  'proj.empty': 'No projects saved yet.',
  'proj.meta': '{cells} cells · {date}',
  'proj.open': 'Open',
  'proj.openAria': 'Open project “{name}”',
  'proj.rename': 'Rename',
  'proj.duplicate': 'Duplicate',
  'proj.delete': 'Delete',
  'proj.copyName': '{name} (copy)',
  'proj.confirmDelete': 'Delete project “{name}” permanently?',
  'proj.confirmNew': 'There are unsaved changes. Start a new project anyway?',
  'proj.confirmOpen': 'Unsaved changes will be lost. Open the project anyway?',
  'proj.storageFull':
    'Browser storage is full or unavailable. Delete projects you no longer need or save the project as a file.',
  'proj.backupHint':
    'Browser data can be removed by the system or by clearing your history. ' +
    'Also save important projects as a file (“Save” in the bar).',
};
