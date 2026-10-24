import { useId, type ReactNode } from 'react';
import { useT } from '../i18n';
import { IconRotateCcw } from './icons';

export interface Option<T> { value: T; label: string; title?: string }

/** Auswahl mit nebeneinanderliegenden Knöpfen (alle Optionen auf einen Blick, gut für Touch). */
export function Segmented<T extends string | boolean | null>(props: {
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

/** Abschnitt mit Überschrift; ohne onReset entfällt der Zurücksetzen-Knopf. */
export function Section(props: { title: string; onReset?: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h3>{props.title}</h3>
        {props.onReset && (
          <button
            type="button"
            className="btn settings-reset"
            title={t('set.resetSectionTitle', { section: props.title })}
            aria-label={t('set.resetSectionAria', { section: props.title })}
            onClick={props.onReset}
          >
            <IconRotateCcw /><span>{t('common.reset')}</span>
          </button>
        )}
      </div>
      {props.children}
    </section>
  );
}
