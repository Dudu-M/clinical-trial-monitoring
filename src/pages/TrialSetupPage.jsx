import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';

export default function TrialSetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useAppStore();

  const existing = id ? state.trials[id] : null;

  const [form, setForm] = useState({
    name: existing?.name || '',
    sponsor: existing?.sponsor || '',
    indication: existing?.indication || '',
    totalTarget: existing?.totalTarget || '',
    startDate: existing?.startDate || '',
    targetCompletionDate: existing?.targetCompletionDate || '',
  });

  const [errors, setErrors] = useState({});
  const isEdit = !!existing;

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
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

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{isEdit ? 'Trial Setup' : 'New Trial'}</h1>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            {isEdit ? 'Update trial metadata and targets.' : 'Set up the trial parameters before uploading data.'}
          </p>
        </div>
        {!isEdit && (
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card card-pad-lg" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
              <input
                className="form-input"
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Completion Date</label>
              <input
                className="form-input"
                type="date"
                value={form.targetCompletionDate}
                onChange={e => set('targetCompletionDate', e.target.value)}
              />
            </div>
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
        </div>
      </form>
    </div>
  );
}
