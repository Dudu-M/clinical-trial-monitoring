const KEYWORD_INSIGHTS = [
  {
    keywords: ['pi considering withdrawing', 'withdrawing', 'withdraw'],
    insight: 'PI withdrawal risk detected — immediate escalation recommended.',
  },
  {
    keywords: ['coordinator changed', 'new coordinator'],
    insight: 'Recent coordinator transition may affect site continuity.',
  },
  {
    keywords: ['leave', 'annual leave', 'absence', 'away', 'off sick'],
    insight: 'Temporary staffing disruption may explain recent metric changes.',
  },
  {
    keywords: ['capacity concerns', 'capacity'],
    insight: 'Site capacity constraints flagged — may limit enrolment pace.',
  },
  {
    keywords: ['eligibility criteria', 'eligibility'],
    insight: 'Eligibility screening issues flagged — possible protocol or population mismatch.',
  },
  {
    keywords: ['protocol deviation'],
    insight: 'Protocol compliance concern noted — review deviation log.',
  },
  {
    keywords: ['strong recruiter', 'high performer', 'experienced'],
    insight: 'Site has a strong performance history — current issues may be temporary.',
  },
  {
    keywords: ['population mismatch', 'inclusion criteria'],
    insight: 'Patient population may not align well with inclusion criteria.',
  },
  {
    keywords: ['additional study', 'additional studies'],
    insight: 'PI workload may be a factor — confirm capacity to prioritise this trial.',
  },
];

export function analyseNote(noteText) {
  if (!noteText) return null;
  const lower = noteText.toLowerCase();
  for (const { keywords, insight } of KEYWORD_INSIGHTS) {
    if (keywords.some(kw => lower.includes(kw))) {
      return insight;
    }
  }
  return null;
}

// Returns array of { rawText, insight } for all notes on a site
export function analyseNotes(notes) {
  return (notes || [])
    .map(note => {
      const raw = typeof note === 'string' ? note : (note?.text || '');
      const insight = analyseNote(raw);
      return { rawText: raw, insight };
    })
    .filter(n => n.rawText);
}
