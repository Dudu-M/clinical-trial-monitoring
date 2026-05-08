import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { DEFAULT_THRESHOLDS, THRESHOLD_LABELS, mergeThresholds } from '../logic/defaultThresholds';

function pctToDisplay(val) { return Math.round(val * 100); }
function displayToPct(str) { return Number(str) / 100; }

function ThresholdGroup({ dimKey, meta, values, onChange }) {
  const { label, hint, fields } = meta;
  const isFlat = dimKey === 'craOverdueDays'; // flat numeric, not nested

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {fields.map(({ key, label: fieldLabel, unit, isPercent }) => {
          const raw = isFlat ? values : values[dimKey]?.[key] ?? DEFAULT_THRESHOLDS[dimKey][key];
          const display = isPercent ? pctToDisplay(raw) : raw;

          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{fieldLabel}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 80, padding: '6px 8px', fontSize: 13 }}
                  value={display}
                  min={0}
                  max={isPercent ? 100 : undefined}
                  onChange={e => {
                    const num = Number(e.target.value);
                    const stored = isPercent ? displayToPct(num) : num;
                    if (isFlat) {
                      onChange(dimKey, null, stored);
                    } else {
                      onChange(dimKey, key, stored);
                    }
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrialSetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useAppStore();

  const existing = id ? state.trials[id] : null;
  const isEdit = !!existing;

  const [form, setForm] = useState({
    name: existing?.name || '',
    sponsor: existing?.sponsor || '',
    indication: existing?.indication || '',
    totalTarget: existing?.totalTarget || '',
    startDate: existing?.startDate || '',
    targetCompletionDate: existing?.targetCompletionDate || '',
  });

  const [thresholds, setThresholds] = useState(() => mergeThresholds(existing?.thresholds));
  const [errors, setErrors] = useState({});
  const [showThresholds, setShowThresholds] = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function handleThresholdChange(dim, key, value) {
    setThresholds(prev => {
      if (key === null) {
        // flat value (e.g. craOverdueDays)
        return { ...prev, [dim]: value };
      }
      return {
        ...prev,
        [dim]: { ...prev[dim], [key]: value },
      };
    });
  }

  function resetThresholds() {
    setThresholds(DEFAULT_THRESHOLDS);
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Trial name is required';
    if (!form.sponsor.trim()) e.sponsor = 'Sponsor is required';
    if (form.totalTarget && isNaN(Number(form.totalTarget))) e.totalTarget = 'Must be a number';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = {
      ...form,
      totalTarget: form.totalTarget ? Number(form.totalTarget) : null,
      thresholds,
    };

    if (isEdit) {
      actions.updateTrial(id, payload);
      navigate(`/trial/${id}`);
    } else {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      actions.createTrial({ ...payload, id: newId });
      navigate(`/trial/${newId}`);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${existing.name}"? This cannot be undone.`)) return;
    actions.deleteTrial(id);
    navigate('/');
  }

  const hasCustomThresholds = JSON.stringify(thresholds) !== JSON.stringify(DEFAULT_THRESHOLDS);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{isEdit ? 'Trial Setup' : 'New Trial'}</h1>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            {isEdit ? 'Update trial metadata, targets, and scoring thresholds.' : 'Set up the trial parameters before uploading data.'}
          </p>
        </div>
        {!isEdit && (
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Trial metadata */}
        <div className="card card-pad-lg" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>

          <div className="form-group">
            <label className="form-label">Trial Name *</label>
            <input
              className={`form-input ${errors.name ? 'border-red' : ''}`}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. CARDINAL-201"
            />
            {errors.name && <span style={{ color: 'var(--red)', fontSize: 12 }}>{errors.name}</span>}
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Sponsor *</label>
              <input
                className="form-input"
                value={form.sponsor}
                onChange={e => set('sponsor', e.target.value)}
                placeholder="e.g. PharmaCo Ltd"
              />
              {errors.sponsor && <span style={{ color: 'var(--red)', fontSize: 12 }}>{errors.sponsor}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Indication</label>
              <input
                className="form-input"
                value={form.indication}
                onChange={e => set('indication', e.target.value)}
                placeholder="e.g. Type 2 Diabetes"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Total Enrollment Target</label>
            <input
              className="form-input"
              value={form.totalTarget}
              onChange={e => set('totalTarget', e.target.value)}
              placeholder="e.g. 150"
              type="number"
              min="1"
            />
            {errors.totalTarget && <span style={{ color: 'var(--red)', fontSize: 12 }}>{errors.totalTarget}</span>}
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Trial Start Date</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Target Completion Date</label>
              <input className="form-input" type="date" value={form.targetCompletionDate} onChange={e => set('targetCompletionDate', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Scoring thresholds */}
        <div className="card card-pad-lg" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showThresholds ? 20 : 0 }}>
            <div>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Scoring Thresholds
                {hasCustomThresholds && (
                  <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)', padding: '2px 7px', borderRadius: 999 }}>
                    Custom
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Control what triggers a Watch (score 1), Warn (score 2), or Critical (score 3) flag for each dimension.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowThresholds(v => !v)}
            >
              {showThresholds ? 'Hide' : 'Edit thresholds'}
            </button>
          </div>

          {showThresholds && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                {Object.entries(THRESHOLD_LABELS).map(([dimKey, meta]) => (
                  <ThresholdGroup
                    key={dimKey}
                    dimKey={dimKey}
                    meta={meta}
                    values={dimKey === 'craOverdueDays' ? thresholds.craOverdueDays : thresholds}
                    onChange={handleThresholdChange}
                  />
                ))}
              </div>
              {hasCustomThresholds && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetThresholds}>
                    ↺ Reset to defaults
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scoring key reference */}
          {!showThresholds && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>Score key: each dimension 0–3</span>
              <span><span style={{ color: 'var(--green)', fontWeight: 700 }}>0</span> No concern</span>
              <span><span style={{ color: 'var(--green)', fontWeight: 700 }}>1</span> Watch</span>
              <span><span style={{ color: 'var(--amber)', fontWeight: 700 }}>2</span> Warning</span>
              <span><span style={{ color: 'var(--red)', fontWeight: 700 }}>3</span> Critical</span>
              <span>Total out of 15 → <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Amber ≥ {thresholds.rag.amber}</span> / <span style={{ color: 'var(--red)', fontWeight: 700 }}>Red ≥ {thresholds.rag.red}</span></span>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete Trial
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isEdit && (
              <button type="button" className="btn btn-ghost" onClick={() => navigate(`/trial/${id}`)}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Save Changes' : 'Create Trial'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
