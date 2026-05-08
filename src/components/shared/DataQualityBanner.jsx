import { useState } from 'react';

export default function DataQualityBanner({ notices, trialId }) {
  const storageKey = trialId ? `dq-dismissed-${trialId}` : null;
  const [dismissed, setDismissed] = useState(
    () => storageKey ? localStorage.getItem(storageKey) === 'true' : false
  );

  if (dismissed || !notices || notices.length === 0) return null;

  function handleDismiss() {
    if (storageKey) localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  }

  return (
    <div className="dq-banner">
      <span className="dq-banner-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </span>
      <div className="dq-banner-content">
        <div className="dq-banner-title">Data quality notices ({notices.length})</div>
        <ul className="dq-banner-list">
          {notices.map((n, i) => <li key={i}>· {n}</li>)}
        </ul>
      </div>
      <button className="dq-banner-close" onClick={handleDismiss} title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
