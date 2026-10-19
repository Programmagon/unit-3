import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useSettingsStore, type Overrides, type Settings } from '../store/settingsStore';
import { OFF_TONE_NAMES } from '../canvas/cellStyle';
import { setThemePref, type ThemePref } from '../lib/theme';
import { useThemePref } from '../lib/useThemePref';
import { IconClose, IconRotateCcw, IconSettings } from './icons';

/** Der Zahnrad-Knopf in der SimBar. Öffnet und schließt das Menü. */
export function SettingsButton() {
  const open = useSettingsStore(s => s.menuOpen);
  const setOpen = useSettingsStore(s => s.setMenuOpen);
  return (
    <button
      id="settings-btn"
      className="btn"
      type="button"
      aria-label="Einstellungen"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="settings-panel"
      title="Einstellungen"
      onClick={() => setOpen(!open)}
    >
      <IconSettings />
    </button>
  );
}

// ── Bausteine ────────────────────────────────────────────────────────

interface Option<T> { value: T; label: string; title?: string }

/** Auswahl mit nebeneinanderliegenden Knöpfen (alle Optionen auf einen Blick, gut für Touch). */
function Segmented<T extends string | boolean | null>(props: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  const { label, value, options, onChange, hint } = props;
  const labelId = useId();
  return (
    <div className="settings-field">
      <div className="settings-label" id={labelId}>{label}</div>
      <div className="settings-seg" role="group" aria-labelledby={labelId}>
        {options.map(o => (
          <button
            key={String(o.value)}
            type="button"
            className="btn"
            aria-pressed={o.value === value}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="settings-hint">{hint}</p>}
    </div>
  );
}

function Section(props: { title: string; onReset: () => void; children: ReactNode }) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h3>{props.title}</h3>
        <button
          type="button"
          className="btn settings-reset"
          title={`${props.title}: auf Standard zurücksetzen`}
          aria-label={`${props.title} zurücksetzen`}
          onClick={props.onReset}
        >
          <IconRotateCcw /><span>Zurücksetzen</span>
        </button>
      </div>
      {props.children}
    </section>
  );
}

const THEME_OPTIONS: Option<ThemePref>[] = [
  { value: 'auto', label: 'Automatisch', title: 'Folgt dem System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

const OFF_TONE_OPTIONS: Option<string | null>[] = [
  { value: null, label: 'Original', title: 'Feste Aus-Farben aus theme.css' },
  ...OFF_TONE_NAMES.map(n => ({ value: n, label: n.slice(0, 1), title: n })),
];

// ── Menü ─────────────────────────────────────────────────────────────

/**
 * Einstellungsmenü. Am PC ein Seitenpanel rechts im Canvas-Bereich, auf dem
 * Handy ein Bottom-Sheet (CSS, .settings-panel in index.css). Änderungen
 * gelten sofort — man sieht hinter dem Panel, was sie am Canvas bewirken.
 *
 * Kein Fokus-Fang (nicht modal): der Canvas bleibt bedienbar. Esc schließt das
 * Menü und gibt den Fokus an den Zahnrad-Knopf zurück. data-no-shortcuts hält
 * die globalen Tastenkürzel (Leertaste = Play, Buchstaben = Werkzeug) aus dem
 * Panel heraus.
 */
export function SettingsMenu() {
  const open       = useSettingsStore(s => s.menuOpen);
  const setOpen    = useSettingsStore(s => s.setMenuOpen);
  const settings   = useSettingsStore(s => s.settings);
  const setSetting = useSettingsStore(s => s.setSetting);
  const reset      = useSettingsStore(s => s.resetSettings);
  const themePref  = useThemePref();
  const closeRef   = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);

  const close = () => {
    setOpen(false);
    document.getElementById('settings-btn')?.focus();
  };

  // Fokus ins Panel beim Öffnen; Esc schließt (Capture-Phase, damit der globale
  // Esc-Handler nicht gleichzeitig eine Auswahl aufhebt).
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      document.getElementById('settings-btn')?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  const set = <K extends keyof Overrides>(key: K) => (v: Overrides[K]) => setSetting(key, v);
  const resetKeys = (...keys: (keyof Overrides)[]) => () => reset(keys);
  const customShape = settings.cellShape === 'custom';

  return (
    <aside
      id="settings-panel"
      className="settings-panel"
      role="dialog"
      aria-label="Einstellungen"
      data-no-shortcuts
    >
      {/* Kopf: auf dem Handy auch Griff zum Wegziehen nach unten */}
      <header
        className="settings-head"
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragStartY.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={e => {
          const y0 = dragStartY.current;
          dragStartY.current = null;
          if (y0 !== null && e.clientY - y0 > 60) close();
        }}
        onPointerCancel={() => { dragStartY.current = null; }}
      >
        <span className="settings-grip" aria-hidden />
        <h2>Einstellungen</h2>
        <button
          ref={closeRef}
          type="button"
          className="btn"
          aria-label="Einstellungen schließen"
          title="Schließen [Esc]"
          onClick={close}
        >
          <IconClose />
        </button>
      </header>

      <div className="settings-body">
        <Section
          title="Darstellung"
          onReset={() => {
            setThemePref('auto');
            reset(['cellShape', 'glyph', 'glow', 'grid', 'offTone']);
          }}
        >
          <Segmented<ThemePref>
            label="Farbschema"
            value={themePref}
            options={THEME_OPTIONS}
            onChange={setThemePref}
          />
          <Segmented<Settings['cellShape']>
            label="Zell-Stil"
            value={settings.cellShape}
            options={[
              { value: 'join',   label: 'Verschmolzen' },
              { value: 'seam',   label: 'Mit Fuge' },
              { value: 'single', label: 'Einzeln' },
            ]}
            onChange={v => { if (v !== 'custom') set('cellShape')(v); }}
            hint={customShape ? 'Aktuell: eigene Werte aus cellStyle.ts. Eine Auswahl ersetzt sie.' : undefined}
          />
          <Segmented<Settings['glyph']>
            label="Symbole"
            value={settings.glyph}
            options={[
              { value: 'none', label: 'Keine' },
              { value: 'sel',  label: 'Umk./Verz.', title: 'Nur Umkehrer und Verzögerer' },
              { value: 'line', label: 'Alle' },
              { value: 'dot',  label: 'Punkt' },
            ]}
            onChange={set('glyph')}
          />
          <Segmented<boolean>
            label="Leuchten"
            value={settings.glow}
            options={[{ value: true, label: 'An' }, { value: false, label: 'Aus' }]}
            onChange={set('glow')}
            hint="Wirkt nur im dunklen Schema."
          />
          <Segmented<boolean>
            label="Raster"
            value={settings.grid}
            options={[{ value: true, label: 'An' }, { value: false, label: 'Aus' }]}
            onChange={set('grid')}
          />
          <Segmented<string | null>
            label="Aus-Farben"
            value={settings.offTone}
            options={OFF_TONE_OPTIONS}
            onChange={set('offTone')}
            hint={<>Ausgeschaltete Zellen im dunklen Schema. C/D: satter, E/F: mit Hintergrund gemischt. Namen per Tooltip.</>}
          />
        </Section>

        <Section title="Bedienung" onReset={resetKeys('straightLine', 'touchTap')}>
          <Segmented<Settings['straightLine']>
            label="Gerade Linie"
            value={settings.straightLine}
            options={[
              { value: 'auto',  label: 'Automatisch' },
              { value: 'off',   label: 'Aus' },
              { value: 'shift', label: 'Mit Umschalt', title: 'Nur solange die Umschalttaste gehalten wird (braucht Tastatur)' },
            ]}
            onChange={set('straightLine')}
            hint="Automatisch: Beim Ziehen rastet die Richtung nach 2 Zellen auf waagerecht oder senkrecht ein. „Mit Umschalt“ braucht eine Tastatur. Beim Löschen gibt es keine Sperre."
          />
          <Segmented<Settings['touchTap']>
            label="Tippen auf Zelle (Touch/Stift)"
            value={settings.touchTap}
            options={[
              { value: 'power',  label: 'Powern' },
              { value: 'delete', label: 'Löschen' },
            ]}
            onChange={set('touchTap')}
            hint={settings.touchTap === 'power'
              ? 'Tippen auf eine Zelle des gleichen Typs schaltet ⊕ (Force) um. Langes Drücken löscht, auch beim Weiterziehen.'
              : 'Tippen auf eine Zelle des gleichen Typs löscht sie. Langes Drücken schaltet ⊕ (Force) um. Wischen zum Löschen geht mit dem Werkzeug „Löschen“.'}
          />
        </Section>

        <button type="button" className="btn btn--danger settings-reset-all" onClick={() => { setThemePref('auto'); reset(); }}>
          <IconRotateCcw /><span>Alle Einstellungen zurücksetzen</span>
        </button>
      </div>
    </aside>
  );
}
