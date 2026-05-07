import { generateSummary } from '../logic/generateSummary';

export default function ExplainabilityPanel({ site, trialMeta }) {
  const summary = generateSummary(site, trialMeta);
  return (
    <div className="explain-panel">
      <p className="explain-panel-label">Risk summary</p>
      <p className="explain-panel-text">{summary}</p>
    </div>
  );
}
