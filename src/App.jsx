import { useState } from 'react';
import UploadScreen from './components/UploadScreen';
import ReportView from './components/ReportView';
import { parseExcel } from './logic/parseExcel';
import { scoreSites } from './logic/scoreSites';

export default function App() {
  const [view, setView] = useState('upload');
  const [reportData, setReportData] = useState(null);

  async function handleFile(arrayBuffer) {
    const { sites, notices, trialMeta } = parseExcel(arrayBuffer);
    const rankedSites = scoreSites(sites, trialMeta);
    setReportData({ rankedSites, notices, trialMeta });
    setView('report');
  }

  function handleReset() {
    setView('upload');
    setReportData(null);
  }

  if (view === 'report' && reportData) {
    return <ReportView data={reportData} onReset={handleReset} />;
  }

  return <UploadScreen onFile={handleFile} />;
}
