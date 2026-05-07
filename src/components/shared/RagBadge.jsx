export default function RagBadge({ status, score }) {
  const cls = status === 'Red' ? 'rag-red' : status === 'Amber' ? 'rag-amber' : 'rag-green';
  const label = status === 'Red' ? 'At Risk' : status === 'Amber' ? 'Monitor' : 'On Track';
  return (
    <span className={`rag ${cls}`}>
      <span className="rag-dot" />
      {label}
      {score !== undefined && <span style={{ opacity: 0.7, marginLeft: 2 }}>({score})</span>}
    </span>
  );
}
