import { useState } from 'react';
import { generateEmail, generateSponsorUpdate } from '../logic/generateEmail';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function CommunicationsDrawer({ site, trialMeta, open }) {
  if (!open) return null;

  const email = generateEmail(site, trialMeta);
  const sponsorUpdate = generateSponsorUpdate(site, trialMeta);
  const fullEmailText = `To: ${email.toEmail}\nSubject: ${email.subject}\n\n${email.body}`;

  return (
    <div className="comms-drawer">
      <div className="comms-drawer-grid">
        <div className="comms-section">
          <div className="comms-section-header">
            <div>
              <p className="comms-section-title">Check-in email to coordinator</p>
              <p className="comms-section-to">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {email.toEmail || email.toName || 'No email on file'}
              </p>
            </div>
            <CopyButton text={fullEmailText} />
          </div>
          <pre className="comms-email-body">{email.body}</pre>
        </div>

        <div className="comms-section">
          <div className="comms-section-header">
            <div>
              <p className="comms-section-title">Sponsor update paragraph</p>
              <p className="comms-section-to">Suitable for monthly sponsor report</p>
            </div>
            <CopyButton text={sponsorUpdate} />
          </div>
          <p className="comms-sponsor-text">{sponsorUpdate}</p>
        </div>
      </div>
    </div>
  );
}
