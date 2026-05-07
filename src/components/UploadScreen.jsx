import { useState, useRef, useCallback } from 'react';

export default function UploadScreen({ onFile }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload a .xlsx file.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      await onFile(buffer);
    } catch (e) {
      setError('Failed to parse file: ' + (e.message || 'Unknown error'));
      setLoading(false);
    }
  }, [onFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, [processFile]);

  const handleChange = (e) => {
    processFile(e.target.files[0]);
    e.target.value = '';
  };

  return (
    <div className="upload-screen">
      <div className="upload-header">
        <div className="upload-logo">
          <span className="upload-logo-mark">◆</span>
          <span className="upload-logo-name">Lindus Health</span>
        </div>
      </div>

      <div className="upload-body">
        <div className="upload-hero">
          <h1 className="upload-title">CARDINAL</h1>
          <p className="upload-subtitle">Trial Site Monitor</p>
          <p className="upload-desc">
            Upload your site data file to generate an instant ranked report of
            site performance, risk signals, and draft communications.
          </p>
        </div>

        <div
          className={`drop-zone${dragOver ? ' drop-zone--active' : ''}${loading ? ' drop-zone--loading' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          {loading ? (
            <>
              <div className="spinner" />
              <p className="drop-zone-hint">Processing data…</p>
            </>
          ) : (
            <>
              <div className="drop-zone-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9 15 12 12 15 15"/>
                </svg>
              </div>
              <p className="drop-zone-label">
                {dragOver ? 'Release to upload' : 'Drop your .xlsx file here'}
              </p>
              <p className="drop-zone-hint">or click to browse</p>
            </>
          )}
        </div>

        {error && <p className="upload-error">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        <div className="upload-footer-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          All processing happens locally in your browser. No data is uploaded to any server.
        </div>
      </div>
    </div>
  );
}
