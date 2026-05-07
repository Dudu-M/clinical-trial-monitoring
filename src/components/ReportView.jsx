import TrialHeader from './TrialHeader';
import DataQualityBanner from './DataQualityBanner';
import SiteCard from './SiteCard';

export default function ReportView({ data, onReset }) {
  const { rankedSites, notices, trialMeta } = data;

  return (
    <div className="report-view">
      <TrialHeader trialMeta={trialMeta} rankedSites={rankedSites} onReset={onReset} />

      <div className="report-content">
        <DataQualityBanner notices={notices} />

        <div className="report-sites-header">
          <h2 className="report-sites-title">Site Performance Ranking</h2>
          <p className="report-sites-subtitle">
            {rankedSites.length} site{rankedSites.length !== 1 ? 's' : ''} — ranked by composite risk score (highest concern first)
          </p>
        </div>

        <div className="site-list">
          {rankedSites.map((site, i) => (
            <SiteCard key={site.id} site={site} trialMeta={trialMeta} rank={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
