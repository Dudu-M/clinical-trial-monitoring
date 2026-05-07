import { useState } from 'react';

export default function DataQualityBanner({ notices }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !notices || notices.length === 0) return null;

  return (
    <div className="dq-banner" role="alert">
      <div className="dq-banner-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div className="dq-banner-content">
        <strong className="dq-banner-title">Data quality notices</strong>
        <ul className="dq-banner-list">
          {notices.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
      <button
        className="dq-banner-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
