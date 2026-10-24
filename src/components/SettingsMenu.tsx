import { useState } from 'react';
import {
  useSettingsStore, TWEAK_KEYS, type Overrides, type Settings, type LangPref, type KeyHints,
} from '../store/settingsStore';
import { OFF_TONE_NAMES } from '../canvas/cellStyle';
import { LOOKS, getLook } from '../canvas/looks';
import { setThemePref, getThemePref, type ThemePref } from '../lib/theme';
import { useThemePref } from '../lib/useThemePref';
import { APP_VERSION, FEEDBACK_URL } from '../lib/appInfo';
import { useT, resolveLang, type TFunc } from '../i18n';
import { PanelShell } from './PanelShell';
import { Segmented, Section, type Option } from './PanelParts';
import { LookPreview } from './LookPreview';
import { KeyBindings } from './KeyBindings';
import { useKeymapStore } from '../store/keymapStore';
import { IconFeedback, IconRotateCcw, IconSettings } from './icons';

/** Der Zahnrad-Knopf in der SimBar. Öffnet und schließt das Menü. */
export function SettingsButton() {
  const t = useT();
  const open = useSettingsStore(s => s.panel === 'settings');
  const openPanel = useSettingsStore(s => s.openPanel);
  return (
    <button
      id="settings-btn"
      className="btn"
      type="button"
      aria-label={t('set.open')}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="settings-panel"
      title={t('set.open')}
      onClick={() => openPanel(open ? null : 'settings')}
    >
      <IconSettings />
    </button>
  );
}

// ── Feedback-Bericht ─────────────────────────────────────────────────

function buildReport(t: TFunc, settings: Settings, overrides: Overrides): string {
  const look = getLook(settings.look);
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const tweaks = TWEAK_KEYS.filter(k => overrides[k] !== undefined);
  return [
    `Unit-3 ${APP_VERSION}`,
    `Look: ${look.letter} (${t(`look.${look.id}.name`)})${tweaks.length ? ` + ${tweaks.map(k => `${k}=${String(settings[k])}`).join(', ')}` : ''}`,
    `Farbschema/Theme: ${getThemePref()} → ${document.documentElement.dataset.theme ?? '?'}`,
    `Sprache/Language: ${settings.language} → ${resolveLang(settings.language)}`,
    `Gerade Linie: ${settings.straightLine} · Tippen: ${settings.touchTap}`,
    `Fenster: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x · Touch: ${touch ? 'ja' : 'nein'}`,
    `Browser: ${navigator.userAgent}`,
    '',
    '— Feedback / Your feedback: —',
    '',
  ].join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback für Kontexte ohne Clipboard-API (ältere iPadOS-Versionen, http)
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

// ── Menü ─────────────────────────────────────────────────────────────

/**
 * Einstellungsmenü. Änderungen gelten sofort — man sieht hinter dem Panel,
 * was sie am Canvas bewirken. Die Looks stehen oben mit Vorschau, damit
 * Beta-Testende die Optik vergleichen und gezielt Feedback geben können.
 */
export function SettingsMenu() {
  return (
    <PanelShell id="settings" title="set.title" closeLabel="set.close">
      <SettingsContent />
    </PanelShell>
  );
}

function SettingsContent() {
  const t          = useT();
  const settings   = useSettingsStore(s => s.settings);
  const overrides  = useSettingsStore(s => s.overrides);
  const setSetting = useSettingsStore(s => s.setSetting);
  const setLook    = useSettingsStore(s => s.setLook);
  const reset      = useSettingsStore(s => s.resetSettings);
  const themePref  = useThemePref();
  const resetKeys_ = useKeymapStore(s => s.resetAll);
  const [note, setNote] = useState<string | null>(null);

  const set = <K extends keyof Overrides>(key: K) => (v: Overrides[K]) => setSetting(key, v);
  const resetKeys = (...keys: (keyof Overrides)[]) => () => reset(keys);
  const tweaked = TWEAK_KEYS.some(k => overrides[k] !== undefined);

  const themeOptions: Option<ThemePref>[] = [
    { value: 'auto',  label: t('theme.auto'), title: t('set.schemeAutoTitle') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark',  label: t('theme.dark') },
  ];
  const onOff = [{ value: true, label: t('common.on') }, { value: false, label: t('common.off') }];
  const offToneOptions: Option<string | null>[] = [
    { value: null, label: t('set.offTone.original'), title: t('set.offTone.originalTitle') },
    ...OFF_TONE_NAMES.map(n => ({ value: n, label: n.slice(0, 1), title: n })),
  ];
  const langOptions: Option<LangPref>[] = [
    { value: 'auto', label: t('set.lang.auto') },
    { value: 'de',   label: 'Deutsch' },
    { value: 'en',   label: 'English' },
  ];

  const sendFeedback = async () => {
    const ok = await copyText(buildReport(t, settings, overrides));
    setNote(ok ? t('set.feedbackCopied') : t('set.feedbackFailed'));
    if (ok && FEEDBACK_URL) window.open(FEEDBACK_URL, '_blank', 'noopener');
  };

  return (
    <>
      <Section title={t('set.sec.look')} onReset={resetKeys('look')}>
        <div className="look-grid" role="group" aria-label={t('set.sec.look')}>
          {LOOKS.map(l => (
            <button
              key={l.id}
              type="button"
              className="look-card"
              aria-pressed={settings.look === l.id}
              onClick={() => setLook(l.id)}
            >
              <LookPreview look={l.id} />
              <span className="look-name"><b>{l.letter}</b> {t(`look.${l.id}.name`)}</span>
              <span className="look-desc">{t(`look.${l.id}.desc`)}</span>
            </button>
          ))}
        </div>
        <p className="settings-hint">
          {t('set.lookHint')}{tweaked ? ` ${t('set.lookTweaked')}.` : ''}
        </p>
      </Section>

      <Section
        title={t('set.sec.appearance')}
        onReset={() => { setThemePref('auto'); reset([...TWEAK_KEYS]); }}
      >
        <Segmented<ThemePref>
          label={t('set.scheme')}
          value={themePref}
          options={themeOptions}
          onChange={setThemePref}
        />
        <Segmented<Settings['glyph']>
          label={t('set.glyph')}
          value={settings.glyph}
          options={[
            { value: 'none', label: t('set.glyph.none') },
            { value: 'sel',  label: t('set.glyph.sel'), title: t('set.glyph.selTitle') },
            { value: 'line', label: t('set.glyph.line') },
            { value: 'dot',  label: t('set.glyph.dot') },
          ]}
          onChange={set('glyph')}
        />
        <Segmented<boolean>
          label={t('set.glow')}
          value={settings.glow}
          options={onOff}
          onChange={set('glow')}
          hint={t('set.glowHint')}
        />
        <Segmented<boolean>
          label={t('set.grid')}
          value={settings.grid}
          options={onOff}
          onChange={set('grid')}
        />
        <Segmented<string | null>
          label={t('set.offTone')}
          value={settings.offTone}
          options={offToneOptions}
          onChange={set('offTone')}
          hint={t('set.offToneHint')}
        />
      </Section>

      <Section title={t('set.sec.controls')} onReset={resetKeys('straightLine', 'touchTap')}>
        <Segmented<Settings['straightLine']>
          label={t('set.straight')}
          value={settings.straightLine}
          options={[
            { value: 'auto',  label: t('set.straight.auto') },
            { value: 'off',   label: t('set.straight.off') },
            { value: 'shift', label: t('set.straight.shift'), title: t('set.straight.shiftTitle') },
          ]}
          onChange={set('straightLine')}
          hint={t('set.straightHint')}
        />
        <Segmented<Settings['touchTap']>
          label={t('set.tap')}
          value={settings.touchTap}
          options={[
            { value: 'power',  label: t('set.tap.power') },
            { value: 'delete', label: t('set.tap.delete') },
          ]}
          onChange={set('touchTap')}
          hint={settings.touchTap === 'power' ? t('set.tapHintPower') : t('set.tapHintDelete')}
        />
      </Section>

      <Section
        title={t('set.sec.keys')}
        onReset={() => { reset(['keyHints']); resetKeys_(); }}
      >
        <Segmented<KeyHints>
          label={t('set.keyHints')}
          value={settings.keyHints}
          options={[
            { value: 'auto', label: t('set.keyHints.auto') },
            { value: 'on',   label: t('set.keyHints.on') },
            { value: 'off',  label: t('set.keyHints.off') },
          ]}
          onChange={set('keyHints')}
          hint={t('set.keyHintsHint')}
        />
        <KeyBindings />
      </Section>

      <Section title={t('set.sec.general')} onReset={resetKeys('language')}>
        <Segmented<LangPref>
          label={t('set.lang')}
          value={settings.language}
          options={langOptions}
          onChange={set('language')}
        />
        <div className="settings-field">
          <div className="settings-label">{t('set.feedback')}</div>
          <button type="button" className="btn" onClick={sendFeedback}>
            <IconFeedback /><span>{t('set.feedbackBtn')}</span>
          </button>
          <p className="settings-hint" role="status">{note ?? t('set.feedbackHint')}</p>
        </div>
        <p className="settings-hint">{t('set.version', { v: APP_VERSION })}</p>
      </Section>

      <button
        type="button"
        className="btn btn--danger settings-reset-all"
        onClick={() => { setThemePref('auto'); reset(); resetKeys_(); setNote(null); }}
      >
        <IconRotateCcw /><span>{t('set.resetAll')}</span>
      </button>
    </>
  );
}
