import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { parseExcel } from '../logic/parseExcel';
import { scoreSites } from '../logic/scoreSites';

function UploadZone({ label, hint, file, onFile }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  }

  function handleChange(e) {
    const f = e.target.files[0];
    if (f) onFile(f);
    e.target.value = '';
  }

  return (
    <div
      className={`upload-zone${file ? ' has-file' : ''}${dragging ? ' drag-over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="upload-zone-icon">
        {file ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        )}
      </div>
      <div className="upload-zone-title">{label}</div>
      <div className="upload-zone-sub">{file ? '' : hint}</div>
      {file && <div className="upload-zone-file">✓ {file.name}</div>}
    </div>
  );
}

function parseResult(result) {
  const { sites, notices } = result;
  const allMonthDates = Object.values(sites).flatMap(s => s.months.map(m => new Date(m.date)));
  const dataEnd = allMonthDates.length > 0 ? new Date(Math.max(...allMonthDates)) : new Date();
  return { sites, notices, dataEnd };
}

export default function DataUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useAppStore();
  const trial = state.trials[id];

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // { sites, notices, dataEnd }
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!trial) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Trial not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to trials</button>
      </div>
    );
  }

  async function handleFile(f) {
    setFile(f);
    setError(null);
    setParsed(null);
    setConfirmed(false);
    setParsing(true);

    try {
      const buf = await f.arrayBuffer();
      const result = parseExcel(buf);
      setParsed(parseResult(result));
    } catch (e) {
      setError('Could not parse file: ' + e.message);
    } finally {
      setParsing(false);
    }
  }

  function handleConfirm() {
    if (!parsed) return;

    const trialMeta = {
      trialName: trial.name,
      sponsor: trial.sponsor,
      totalTarget: trial.totalTarget || 120,
      dataEnd: parsed.dataEnd,
    };
    const scored = scoreSites(parsed.sites, trialMeta, trial.thresholds);

    // Convert scored sites array to keyed object for storage
    const sitesObj = {};
    for (const site of scored) {
      sitesObj[site.id] = site;
    }

    actions.saveUpload(id, sitesObj, parsed.notices);
    setConfirmed(true);
  }

  function dataEndLabel(d) {
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  const existingSiteCount = Object.keys(trial.sites || {}).length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Upload Data</h1>
          <p className="text-secondary" style={{ marginTop: 4, fontSize: 13 }}>
            Upload an Excel workbook containing enrolment, quality, and site contact sheets.
          </p>
        </div>
      </div>

      {confirmed ? (
        <div className="card card-pad-lg">
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Data saved successfully</div>
            <div className="empty-state-text">
              {Object.keys(parsed.sites).length} sites updated. Any existing notes and email logs have been preserved.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/trial/${id}`)}>
                View Dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => {
                setFile(null); setParsed(null); setConfirmed(false); setError(null);
              }}>
                Upload Another File
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Expected format hint */}
          <div className="card card-pad" style={{ marginBottom: 20, background: 'var(--navy-pale)', border: '1px solid #C5D3E8' }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Expected workbook format</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { sheet: 'Trial Overview', cols: 'Trial Name, Sponsor, Total Target' },
                { sheet: 'Site Contacts', cols: 'Site, Hospital, PI Name, PI Email, Coordinator Name, Coordinator Email, Date Activated, Last Monitoring Visit' },
                { sheet: 'Enrolment', cols: 'Site, Month, Enrolled, Target, Screen Failures' },
                { sheet: 'Quality / SDV', cols: 'Site, Month, Queries >14 days, SDV %, Deviations' },
              ].map(({ sheet, cols }) => (
                <div key={sheet}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{sheet}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cols}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload zone */}
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <UploadZone
              label="Drop Excel file here or click to browse"
              hint=".xlsx or .xls workbook containing all sheets"
              file={file}
              onFile={handleFile}
            />
          </div>

          {parsing && (
            <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Parsing file…
            </div>
          )}

          {error && (
            <div className="dq-banner" style={{ marginBottom: 20, background: 'var(--red-bg)', borderColor: 'var(--red-border)' }}>
              <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>{error}</div>
            </div>
          )}

          {parsed && !parsing && (
            <div className="card card-pad-lg" style={{ marginBottom: 20 }}>
              <div className="section-title" style={{ marginBottom: 14 }}>Preview</div>

              {/* Data quality notices */}
              {parsed.notices.length > 0 && (
                <div className="dq-banner" style={{ marginBottom: 16 }}>
                  <span className="dq-banner-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </span>
                  <div className="dq-banner-content">
                    <div className="dq-banner-title">Data quality notices ({parsed.notices.length} applied)</div>
                    <ul className="dq-banner-list">
                      {parsed.notices.map((n, i) => <li key={i}>· {n}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* Site summary table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Hospital</th>
                      <th className="num">Months</th>
                      <th className="num">Enrolled</th>
                      <th className="num">Screen Failures</th>
                      <th className="num">Avg SDV%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(parsed.sites)
                      .sort((a, b) => a.id.localeCompare(b.id))
                      .map(site => {
                        const totalEnrolled = site.months.reduce((s, m) => s + (m.enrolled || 0), 0);
                        const totalSF = site.months.reduce((s, m) => s + (m.screenFailures || 0), 0);
                        const sdvVals = site.months.map(m => m.sdvPct).filter(v => v != null);
                        const avgSdv = sdvVals.length > 0 ? Math.round((sdvVals.reduce((a, b) => a + b, 0) / sdvVals.length) * 100) : null;
                        return (
                          <tr key={site.id}>
                            <td style={{ fontWeight: 600 }}>{site.rawName}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{site.hospital || '—'}</td>
                            <td className="num">{site.months.length}</td>
                            <td className="num">{totalEnrolled}</td>
                            <td className="num">{totalSF}</td>
                            <td className="num">{avgSdv !== null ? `${avgSdv}%` : '—'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Data period */}
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Data period: </span>
                <span style={{ color: 'var(--text-secondary)' }}>through {dataEndLabel(parsed.dataEnd)}</span>
                {existingSiteCount > 0 && (
                  <span style={{ marginLeft: 12, color: 'var(--amber)', fontWeight: 500 }}>
                    · Existing notes and email logs will be preserved
                  </span>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => { setFile(null); setParsed(null); }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleConfirm}>
                  Confirm &amp; Save Data
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
