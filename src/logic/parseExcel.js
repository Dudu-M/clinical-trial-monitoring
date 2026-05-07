import * as XLSX from 'xlsx';

// Normalise any site identifier to 'SITE-A', 'SITE-B', etc.
function normaliseSiteId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  // Short form from Quality sheet: 'A', 'B', ...
  if (/^[A-Z]$/.test(s)) return `SITE-${s}`;
  // 'SITE-A', 'SITE A', 'SITEA' (typo), 'SiteA'
  const m = s.match(/^SITE-?([A-Z])$/);
  if (m) return `SITE-${m[1]}`;
  return s;
}

function parseExcelDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Excel serial date → JS Date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!isNaN(d)) return d;
  }
  return null;
}

function formatMonthLabel(date) {
  return date.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
}

// Get the column index whose header contains all of the given substrings (case-insensitive)
function colIdx(headers, ...fragments) {
  return headers.findIndex(h => fragments.every(f => h.includes(f.toLowerCase())));
}

function parseSheetRows(workbook, sheetKeyword) {
  const name = workbook.SheetNames.find(n => n.toLowerCase().includes(sheetKeyword.toLowerCase()));
  if (!name) return { name: null, rows: [] };
  const ws = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return { name, rows };
}

function modalValue(values) {
  const freq = {};
  values.forEach(v => { if (v != null) freq[v] = (freq[v] || 0) + 1; });
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? Number(entries[0][0]) : null;
}

export function parseExcel(arrayBuffer) {
  const notices = [];
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  // ── Trial Overview ──────────────────────────────────────────────────────
  const { rows: overviewRows } = parseSheetRows(workbook, 'trial');
  let trialName = 'CARDINAL';
  let sponsor = 'Hartwell Therapeutics';
  let totalTarget = null;
  if (overviewRows.length > 0) {
    for (const row of overviewRows) {
      for (let i = 0; i < row.length - 1; i++) {
        const key = String(row[i] || '').toLowerCase();
        if (key.includes('trial') && key.includes('name')) trialName = String(row[i + 1] || trialName);
        if (key.includes('sponsor')) sponsor = String(row[i + 1] || sponsor);
        if (key.includes('total') && key.includes('target')) totalTarget = Number(row[i + 1]) || null;
      }
    }
  }

  // ── Site Contacts ───────────────────────────────────────────────────────
  const { rows: contactRows } = parseSheetRows(workbook, 'contact');
  const contactMap = {}; // SITE-X → contact info
  if (contactRows.length > 1) {
    const hdr = contactRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol = colIdx(hdr, 'site');
    const hospCol = colIdx(hdr, 'hospital');
    const piNameCol = colIdx(hdr, 'pi', 'name') !== -1 ? colIdx(hdr, 'pi', 'name') : colIdx(hdr, 'investigator');
    const piEmailCol = colIdx(hdr, 'pi', 'email') !== -1 ? colIdx(hdr, 'pi', 'email') : -1;
    const coordNameCol = colIdx(hdr, 'coord', 'name') !== -1 ? colIdx(hdr, 'coord', 'name') : colIdx(hdr, 'coordinator');
    const coordEmailCol = colIdx(hdr, 'coord', 'email') !== -1 ? colIdx(hdr, 'coord', 'email') : -1;
    const activatedCol = colIdx(hdr, 'activat');
    const visitCol = colIdx(hdr, 'last', 'visit') !== -1 ? colIdx(hdr, 'last', 'visit') : colIdx(hdr, 'monitor');
    const notesCol = colIdx(hdr, 'note');

    for (let i = 1; i < contactRows.length; i++) {
      const row = contactRows[i];
      if (!row[siteCol]) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;
      contactMap[id] = {
        hospital: hospCol >= 0 ? (row[hospCol] || '') : '',
        pi: {
          name: piNameCol >= 0 ? (row[piNameCol] || '') : '',
          email: piEmailCol >= 0 ? (row[piEmailCol] || '') : '',
        },
        coordinator: {
          name: coordNameCol >= 0 ? (row[coordNameCol] || '') : '',
          email: coordEmailCol >= 0 ? (row[coordEmailCol] || '') : '',
        },
        dateActivated: activatedCol >= 0 ? parseExcelDate(row[activatedCol]) : null,
        lastMonitoringVisit: visitCol >= 0 ? parseExcelDate(row[visitCol]) : null,
        notes: notesCol >= 0 ? [row[notesCol]].filter(Boolean) : [],
      };
    }
  }

  // ── Enrolment ───────────────────────────────────────────────────────────
  const { rows: enrolRows } = parseSheetRows(workbook, 'enrol');
  const enrolBySite = {}; // SITE-X → [{ month, date, enrolled, target, screenFailures }]
  let siteBAliasFixed = false;

  if (enrolRows.length > 1) {
    const hdr = enrolRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol = colIdx(hdr, 'site');
    const monthCol = colIdx(hdr, 'month');
    const enrolledCol = colIdx(hdr, 'enroll');
    const targetCol = colIdx(hdr, 'target');
    const sfCol = colIdx(hdr, 'screen fail') !== -1 ? colIdx(hdr, 'screen fail') : colIdx(hdr, 'failure');
    const notesCol = colIdx(hdr, 'note');

    for (let i = 1; i < enrolRows.length; i++) {
      const row = enrolRows[i];
      if (row[siteCol] == null) continue;
      const rawSiteId = String(row[siteCol]).trim();

      // Rule 1 — detect SiteB typo (no space, no hyphen)
      if (/^SiteB$/i.test(rawSiteId) || /^SITEB$/i.test(rawSiteId)) {
        if (!siteBAliasFixed) {
          notices.push(`Data quality: "SiteB" typo detected and corrected to "Site B" in Enrolment sheet (row ${i + 1}).`);
          siteBAliasFixed = true;
        }
      }

      const id = normaliseSiteId(rawSiteId);
      if (!id) continue;

      const rawMonth = row[monthCol];
      const monthDate = parseExcelDate(rawMonth);
      if (!monthDate) continue;
      // Normalise to first of month
      const monthFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

      const enrolled = row[enrolledCol] != null ? Number(row[enrolledCol]) : null;
      const target = row[targetCol] != null && row[targetCol] !== '' ? Number(row[targetCol]) : null;
      const screenFailures = sfCol >= 0 && row[sfCol] != null ? Number(row[sfCol]) : 0;
      const rowNotes = notesCol >= 0 && row[notesCol] ? [String(row[notesCol])] : [];

      if (!enrolBySite[id]) enrolBySite[id] = [];
      enrolBySite[id].push({
        month: formatMonthLabel(monthFirst),
        date: monthFirst,
        enrolled: isNaN(enrolled) ? 0 : enrolled,
        target,
        screenFailures: isNaN(screenFailures) ? 0 : screenFailures,
        notes: rowNotes,
      });
    }
  }

  // ── SDV & Quality ───────────────────────────────────────────────────────
  const { rows: qualRows } = parseSheetRows(workbook, 'qual');
  const qualBySite = {}; // SITE-X → [{ date, queriesAged, sdvPct, deviations }]

  if (qualRows.length > 1) {
    const hdr = qualRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol = colIdx(hdr, 'site');
    const monthCol = colIdx(hdr, 'month');
    const queriesCol = colIdx(hdr, 'quer', '14') !== -1 ? colIdx(hdr, 'quer', '14') : colIdx(hdr, 'aged');
    const sdvCol = colIdx(hdr, 'sdv');
    const devCol = colIdx(hdr, 'deviat') !== -1 ? colIdx(hdr, 'deviat') : colIdx(hdr, 'protocol');
    const visitCol = colIdx(hdr, 'last', 'visit') !== -1 ? colIdx(hdr, 'last', 'visit') : colIdx(hdr, 'monitor');

    for (let i = 1; i < qualRows.length; i++) {
      const row = qualRows[i];
      if (row[siteCol] == null) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;

      const rawMonth = row[monthCol];
      const monthDate = parseExcelDate(rawMonth);
      if (!monthDate) continue;
      const monthFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

      const queriesAged = queriesCol >= 0 && row[queriesCol] != null ? Number(row[queriesCol]) : 0;

      // Rule 2 — SDV normalisation
      let sdvPct = sdvCol >= 0 && row[sdvCol] != null ? Number(row[sdvCol]) : null;
      if (sdvPct != null && !isNaN(sdvPct) && sdvPct > 1.0) {
        sdvPct = sdvPct / 100;
        notices.push(`Data quality: SDV% values for ${id} appear to be whole-number percentages and have been normalised (divided by 100).`);
      }

      const deviations = devCol >= 0 && row[devCol] != null ? Number(row[devCol]) : 0;
      const visitDate = visitCol >= 0 ? parseExcelDate(row[visitCol]) : null;

      if (!qualBySite[id]) qualBySite[id] = [];
      qualBySite[id].push({
        date: monthFirst,
        queriesAged: isNaN(queriesAged) ? 0 : queriesAged,
        sdvPct: sdvPct != null && !isNaN(sdvPct) ? sdvPct : null,
        deviations: isNaN(deviations) ? 0 : deviations,
        monitoringVisitDate: visitDate,
      });
    }
  }

  // Deduplicate SDV normalisation notices per site
  const seenSdvNotices = new Set();
  const deduplicatedNotices = [];
  for (const n of notices) {
    if (n.includes('SDV%')) {
      const siteMatch = n.match(/SITE-[A-Z]/);
      const key = siteMatch ? siteMatch[0] : n;
      if (seenSdvNotices.has(key)) continue;
      seenSdvNotices.add(key);
    }
    deduplicatedNotices.push(n);
  }

  // ── Merge into site objects ─────────────────────────────────────────────
  const allSiteIds = new Set([
    ...Object.keys(contactMap),
    ...Object.keys(enrolBySite),
    ...Object.keys(qualBySite),
  ]);

  const sites = {};
  for (const id of allSiteIds) {
    const contact = contactMap[id] || {};
    const enrolMonths = (enrolBySite[id] || []).sort((a, b) => a.date - b.date);
    const qualMonths = (qualBySite[id] || []).sort((a, b) => a.date - b.date);
    const dateActivated = contact.dateActivated || null;
    const activationMonthStart = dateActivated
      ? new Date(dateActivated.getFullYear(), dateActivated.getMonth(), 1)
      : null;

    // Rule 3 — impute missing targets
    const allTargets = enrolMonths.map(m => m.target).filter(t => t != null);
    const modal = modalValue(allTargets);
    const filteredEnrolMonths = enrolMonths.map(m => {
      if (m.target == null && modal != null) {
        deduplicatedNotices.push(
          `Data quality: ${id} had a missing monthly target in ${m.month} — imputed using modal target (${modal}).`
        );
        return { ...m, target: modal, targetImputed: true };
      }
      return m;
    });

    // Rule 4 — filter out months before activation
    const activeEnrolMonths = activationMonthStart
      ? filteredEnrolMonths.filter(m => m.date >= activationMonthStart)
      : filteredEnrolMonths;

    const activeQualMonths = activationMonthStart
      ? qualMonths.filter(m => m.date >= activationMonthStart)
      : qualMonths;

    // Determine last monitoring visit: check both contact sheet and quality sheet
    let lastVisit = contact.lastMonitoringVisit || null;
    for (const qm of activeQualMonths) {
      if (qm.monitoringVisitDate) {
        if (!lastVisit || qm.monitoringVisitDate > lastVisit) lastVisit = qm.monitoringVisitDate;
      }
    }

    // Merge enrol + quality months by date
    const monthMap = {};
    for (const em of activeEnrolMonths) {
      const key = em.date.getTime();
      monthMap[key] = { ...em };
    }
    for (const qm of activeQualMonths) {
      const key = qm.date.getTime();
      if (monthMap[key]) {
        monthMap[key] = { ...monthMap[key], ...qm };
      } else {
        monthMap[key] = { date: qm.date, month: formatMonthLabel(qm.date), ...qm };
      }
    }

    const months = Object.values(monthMap).sort((a, b) => a.date - b.date);

    // Collect all notes
    const siteNotes = [
      ...(contact.notes || []),
      ...activeEnrolMonths.flatMap(m => m.notes || []),
    ].filter(Boolean);

    sites[id] = {
      id,
      rawName: id.replace('SITE-', 'Site '),
      hospital: contact.hospital || '',
      pi: contact.pi || { name: '', email: '' },
      coordinator: contact.coordinator || { name: '', email: '' },
      dateActivated,
      lastMonitoringVisit: lastVisit,
      months,
      notes: siteNotes,
      dataQualityFlags: [],
    };

    if (activeEnrolMonths.some(m => m.targetImputed)) sites[id].dataQualityFlags.push('target_imputed');
    if (qualBySite[id] && qualBySite[id].some(m => m.sdvPct != null)) {
      const rawSdv = qualBySite[id].find(m => {
        const row = qualRows.find(r => {
          const hdr = qualRows[0].map(h => String(h || '').trim().toLowerCase());
          const siteCol = colIdx(hdr, 'site');
          return r[siteCol] != null && normaliseSiteId(r[siteCol]) === id;
        });
        return row;
      });
    }
  }

  // Calculate trial-level metadata
  const allDates = Object.values(sites).flatMap(s => s.months.map(m => m.date));
  const dataStart = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const dataEnd = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  // dataEnd is end of last month
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);

  const trialMeta = {
    trialName,
    sponsor,
    totalTarget: totalTarget || 120,
    dataStart,
    dataEnd: dataEndMonth,
  };

  return { sites, notices: deduplicatedNotices, trialMeta };
}
