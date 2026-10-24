import { useState } from 'react';
import { useProjectStore, formatDate } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { MAX_NAME_LENGTH } from '../lib/projects';
import { useT } from '../i18n';
import { PanelShell } from './PanelShell';
import { Segmented, Section } from './PanelParts';
import { IconCopy, IconOpen, IconPlus, IconRename, IconSave, IconTrash } from './icons';

/** Projekte, die im Browser gespeichert sind (localStorage). */
export function ProjectsPanel() {
  return (
    <PanelShell id="projects" title="proj.title" closeLabel="proj.close">
      <ProjectsContent />
    </PanelShell>
  );
}

function ProjectsContent() {
  const t         = useT();
  const projects  = useProjectStore(s => s.projects);
  const currentId = useProjectStore(s => s.currentId);
  const dirty     = useProjectStore(s => s.dirty);
  const save      = useProjectStore(s => s.save);
  const saveAs    = useProjectStore(s => s.saveAs);
  const open      = useProjectStore(s => s.open);
  const newProject = useProjectStore(s => s.newProject);
  const rename    = useProjectStore(s => s.rename);
  const duplicate = useProjectStore(s => s.duplicate);
  const remove    = useProjectStore(s => s.remove);
  const autosave  = useSettingsStore(s => s.settings.autosave);
  const setSetting = useSettingsStore(s => s.setSetting);

  const current = projects.find(p => p.id === currentId) ?? null;
  // Eingabefeld: leer = Name des aktuellen Projekts bzw. Standardname
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? current?.name ?? '';

  const afterSave = (ok: boolean) => { if (ok) setDraftName(null); };

  const guardDirty = (msg: 'proj.confirmNew' | 'proj.confirmOpen'): boolean => {
    useProjectStore.getState().refreshDirty(); // aktueller Stand, nicht der gebündelte
    return !useProjectStore.getState().dirty || window.confirm(t(msg));
  };

  const status = current === null ? t('proj.draft') : dirty ? t('proj.dirty') : t('proj.clean');

  return (
    <>
      <Section title={t('proj.current')}>
        <div className="settings-field">
          <label className="settings-label" htmlFor="project-name">{t('proj.name')}</label>
          <input
            id="project-name"
            className="proj-input"
            type="text"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('proj.name')}
            autoComplete="off"
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') afterSave(save(name)); }}
          />
          <p className="settings-hint" role="status" data-dirty={dirty}>{status}</p>
        </div>
        <div className="settings-seg">
          <button type="button" className="btn" onClick={() => afterSave(save(name))}>
            <IconSave /><span>{t('proj.save')}</span>
          </button>
          <button type="button" className="btn" onClick={() => afterSave(saveAs(name))}>
            <IconCopy /><span>{t('proj.saveAs')}</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => { if (guardDirty('proj.confirmNew')) { newProject(); setDraftName(null); } }}
          >
            <IconPlus /><span>{t('proj.new')}</span>
          </button>
        </div>
      </Section>

      <Section title={t('proj.autosave')}>
        <Segmented<boolean>
          label={t('proj.autosave')}
          value={autosave}
          options={[{ value: true, label: t('common.on') }, { value: false, label: t('common.off') }]}
          onChange={v => setSetting('autosave', v)}
          hint={t('proj.autosaveHint')}
        />
      </Section>

      <Section title={t('proj.list')}>
        {projects.length === 0 ? (
          <p className="settings-hint">{t('proj.empty')}</p>
        ) : (
          <ul className="proj-list">
            {projects.map(p => (
              <li key={p.id} className="proj-item" data-current={p.id === currentId}>
                <button
                  type="button"
                  className="proj-open"
                  aria-label={t('proj.openAria', { name: p.name })}
                  onClick={() => { if (p.id === currentId || guardDirty('proj.confirmOpen')) { open(p.id); setDraftName(null); } }}
                >
                  <span className="proj-name">{p.name}</span>
                  <span className="proj-meta">{t('proj.meta', { cells: p.cells, date: formatDate(p.updated, true) })}</span>
                </button>
                <div className="proj-actions">
                  <button type="button" className="btn" title={t('proj.open')} aria-label={t('proj.openAria', { name: p.name })}
                    onClick={() => { if (p.id === currentId || guardDirty('proj.confirmOpen')) { open(p.id); setDraftName(null); } }}>
                    <IconOpen />
                  </button>
                  <button type="button" className="btn" title={t('proj.rename')} aria-label={`${t('proj.rename')}: ${p.name}`}
                    onClick={() => {
                      const n = window.prompt(t('proj.name'), p.name);
                      if (n !== null) { rename(p.id, n); setDraftName(null); }
                    }}>
                    <IconRename />
                  </button>
                  <button type="button" className="btn" title={t('proj.duplicate')} aria-label={`${t('proj.duplicate')}: ${p.name}`}
                    onClick={() => duplicate(p.id)}>
                    <IconCopy />
                  </button>
                  <button type="button" className="btn btn--danger" title={t('proj.delete')} aria-label={`${t('proj.delete')}: ${p.name}`}
                    onClick={() => { if (window.confirm(t('proj.confirmDelete', { name: p.name }))) remove(p.id); }}>
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="settings-hint">{t('proj.backupHint')}</p>
      </Section>
    </>
  );
}
