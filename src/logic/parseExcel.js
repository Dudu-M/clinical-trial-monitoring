import * as XLSX from 'xlsx';

function normaliseSiteId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]$/.test(s)) return `SITE-${s}`;
  const m = s.match(/^SITE-?([A-Z])$/);
  if (m) return `SITE-${m[1]}`;
  return s;
}

// Parse Excel serial numbers AND common string date formats like "12-Jan-26", "Jan-26", "01-Nov-25"
function parseExcelDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return isNaN(raw) ? null : raw;
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    const MON = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

    // "dd-Mon-yy"  e.g. "12-Jan-26", "08-Jan-26", "31-Jul-26"
    let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (m) {
      const mo = MON[m[2].toLowerCase()];
      if (mo !== undefined) return new Date(2000 + parseInt(m[3]), mo, parseInt(m[1]));
    }
    // "dd-Mon-yyyy" e.g. "01-Nov-2025"
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (m) {
      const mo = MON[m[2].toLowerCase()];
      if (mo !== undefined) return new Date(parseInt(m[3]), mo, parseInt(m[1]));
    }
    // "Mon-yy" e.g. "Jan-26" (period column in Quality sheet)
    m = s.match(/^([A-Za-z]{3})-(\d{2})$/);
    if (m) {
      const mo = MON[m[1].toLowerCase()];
      if (mo !== undefined) return new Date(2000 + parseInt(m[2]), mo, 1);
    }
    // "Month YYYY" e.g. "January 2026" (period in Enrolment sheet)
    m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (m) {
      const d = new Date(`${m[1]} 1, ${m[2]}`);
      if (!isNaN(d)) return d;
    }
    // ISO or other standard formats
    const d = new Date(s);
    if (!isNaN(d)) return d;
  }
  return null;
}

function formatMonthLabel(date) {
  return date.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
}

// Find first header column index that contains ALL given fragments (case-insensitive)
function colIdx(headers, ...fragments) {
  return headers.findIndex(h => fragments.every(f => h.includes(f.toLowerCase())));
}

// Try multiple fragment sets in order, return first match
function colIdxAny(headers, ...alternatives) {
  for (const frags of alternatives) {
    const idx = headers.findIndex(h => frags.every(f => h.includes(f.toLowerCase())));
    if (idx !== -1) return idx;
  }
  return -1;
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
  let indication = '';
  let totalTarget = null;
  let requiredRunRate = null;
  let targetCompletionDate = null;
  let trialStartDate = null;
  let monthsRemainingFromSheet = null;

  if (overviewRows.length > 0) {
    for (const row of overviewRows) {
      if (!row || row[0] == null) continue;
      const key = String(row[0]).toLowerCase().trim();
      const val = row[1];
      if (val == null && val !== 0) continue;

      if (key.includes('trial') && key.includes('name')) trialName = String(val);
      else if (key.includes('sponsor'))                   sponsor = String(val);
      else if (key.includes('indication') || key.includes('condition')) indication = String(val);
      else if (key.includes('target') && key.includes('total'))         totalTarget = Number(val) || null;
      else if (key.includes('total') && key.includes('enrolment'))      totalTarget = totalTarget || Number(val) || null;
      else if (key.includes('required') && key.includes('run'))         requiredRunRate = Number(val) || null;
      else if (key.includes('months remaining'))                         monthsRemainingFromSheet = Number(val) || null;
      else if (key.includes('completion date') || key.includes('enrolment completion date')) targetCompletionDate = parseExcelDate(val);
      else if (key.includes('start date'))                               trialStartDate = parseExcelDate(val);
    }
  }

  // ── Site Contacts ───────────────────────────────────────────────────────
  const { rows: contactRows } = parseSheetRows(workbook, 'contact');
  const contactMap = {};

  if (contactRows.length > 1) {
    const hdr = contactRows[0].map(h => String(h || '').trim().toLowerCase());

    // "Site Ref" or "Site" or "Site ID"
    const siteCol = colIdxAny(hdr, ['site ref'], ['site id'], ['site']);
    // "Principal Investigator" — match on 'investigator' alone
    const piNameCol = colIdxAny(hdr, ['principal investigator'], ['investigator'], ['pi name'], ['pi']);
    const piEmailCol = colIdxAny(hdr, ['pi email'], ['investigator email']);
    // "Coordinator" or "Coordinator Name"
    const coordNameCol = colIdxAny(hdr, ['coordinator name'], ['coordinator']);
    const coordEmailCol = colIdxAny(hdr, ['coordinator email'], ['coord email']);
    const activatedCol  = colIdxAny(hdr, ['date activated'], ['activated'], ['activation']);
    const visitCol      = colIdxAny(hdr, ['last monitoring'], ['last visit'], ['monitoring visit']);
    const notesCol      = colIdx(hdr, 'note');

    for (let i = 1; i < contactRows.length; i++) {
      const row = contactRows[i];
      if (!row || row[siteCol] == null) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;
      contactMap[id] = {
        hospital: colIdxAny(hdr, ['hospital']) >= 0 ? (row[colIdxAny(hdr, ['hospital'])] || '') : '',
        pi: {
          name:  piNameCol  >= 0 ? (row[piNameCol]  || '') : '',
          email: piEmailCol >= 0 ? (row[piEmailCol] || '') : '',
        },
        coordinator: {
          name:  coordNameCol  >= 0 ? (row[coordNameCol]  || '') : '',
          email: coordEmailCol >= 0 ? (row[coordEmailCol] || '') : '',
        },
        dateActivated:        activatedCol >= 0 ? parseExcelDate(row[activatedCol]) : null,
        lastMonitoringVisit:  visitCol     >= 0 ? parseExcelDate(row[visitCol])     : null,
        notes: notesCol >= 0 && row[notesCol] ? [String(row[notesCol])] : [],
      };
    }
  }

  // ── Enrolment ───────────────────────────────────────────────────────────
  // Sheet: "Enrolment"
  // Headers: Site | Site Name | Month | Target | Enrolled | Screen Failures | Notes
  const { rows: enrolRows } = parseSheetRows(workbook, 'enrol');
  const enrolBySite = {};
  let siteBAliasFixed = false;

  if (enrolRows.length > 1) {
    const hdr = enrolRows[0].map(h => String(h || '').trim().toLowerCase());
    // "Site" is col 0, but "Site Name" is col 1 — pick the shorter one (first 'site' without 'name')
    const siteCol     = hdr.findIndex(h => h === 'site' || (h.includes('site') && !h.includes('name') && !h.includes('id') && !h.includes('ref')));
    const monthCol    = colIdxAny(hdr, ['month'], ['period'], ['date']);
    const enrolledCol = colIdxAny(hdr, ['enrolled'], ['enroll'], ['patients enrolled']);
    const targetCol   = colIdxAny(hdr, ['target']);
    const sfCol       = colIdxAny(hdr, ['screen fail'], ['screen_fail'], ['failures']);
    const notesCol    = colIdx(hdr, 'note');

    const seenKeys = {};

    for (let i = 1; i < enrolRows.length; i++) {
      const row = enrolRows[i];
      if (!row || row[siteCol] == null) continue;
      const rawSiteId = String(row[siteCol]).trim();

      // Rule 1 — SiteB typo
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
      const monthFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

      // Duplicate detection
      const dupeKey = `${id}::${monthFirst.getTime()}`;
      if (seenKeys[dupeKey]) {
        notices.push(`Duplicate enrolment records detected for ${id.replace('SITE-', 'Site ')} in ${formatMonthLabel(monthFirst)}.`);
        continue;
      }
      seenKeys[dupeKey] = true;

      const enrolled      = enrolledCol >= 0 && row[enrolledCol] != null ? Number(row[enrolledCol]) : null;
      const target        = targetCol  >= 0 && row[targetCol]  != null && row[targetCol] !== '' ? Number(row[targetCol]) : null;
      const screenFails   = sfCol      >= 0 && row[sfCol]      != null ? Number(row[sfCol]) : 0;
      const rowNotes      = notesCol   >= 0 && row[notesCol]   ? [String(row[notesCol])] : [];

      if (!enrolBySite[id]) enrolBySite[id] = [];
      enrolBySite[id].push({
        month: formatMonthLabel(monthFirst),
        date:  monthFirst,
        enrolled:       isNaN(enrolled) ? 0 : (enrolled ?? 0),
        target,
        screenFailures: isNaN(screenFails) ? 0 : screenFails,
        notes:          rowNotes,
      });
    }
  }

  // ── SDV & Quality ───────────────────────────────────────────────────────
  // Sheet: "SDV & Quality"
  // Headers: Site ID | Hospital | Period | Queries Open | Queries >14d | SDV Complete (%) | Protocol Deviations | Last Monitoring Visit
  const { rows: qualRows } = parseSheetRows(workbook, 'quality');
  const qualBySite = {};
  const sdvNormalisedSites = new Set();

  if (qualRows.length > 1) {
    const hdr = qualRows[0].map(h => String(h || '').trim().toLowerCase());

    const siteCol    = colIdxAny(hdr, ['site id'], ['site ref'], ['site']);
    // Period/Month column — the sheet uses "Period" not "Month"
    const monthCol   = colIdxAny(hdr, ['period'], ['month'], ['date']);
    // "Queries >14d" — prefer the aged/14d column over "Queries Open"
    const queriesCol = colIdxAny(hdr, ['queries >14', 'queries>14', '>14d', '14d'], ['queries >14'], ['>14'], ['aged queries'], ['queries open']);
    // We need the ">14d" column specifically
    const queriesAgedCol = hdr.findIndex(h => h.includes('>14') || h.includes('14d') || h.includes('aged'));
    const sdvCol     = colIdxAny(hdr, ['sdv complete'], ['sdv%'], ['sdv']);
    const devCol     = colIdxAny(hdr, ['protocol deviation'], ['deviation']);
    const visitCol   = colIdxAny(hdr, ['last monitoring visit'], ['monitoring visit'], ['last visit'], ['last monitoring']);

    const seenQualKeys = {};

    for (let i = 1; i < qualRows.length; i++) {
      const row = qualRows[i];
      if (!row || row[siteCol] == null) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;

      const rawPeriod = row[monthCol];
      const monthDate = parseExcelDate(rawPeriod);
      if (!monthDate) continue;
      const monthFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

      // Dedup
      const dupeKey = `${id}::${monthFirst.getTime()}`;
      if (seenQualKeys[dupeKey]) continue;
      seenQualKeys[dupeKey] = true;

      // Use the specific ">14d" column
      const qColToUse = queriesAgedCol >= 0 ? queriesAgedCol : queriesCol;
      const queriesAged = qColToUse >= 0 && row[qColToUse] != null ? Number(row[qColToUse]) : 0;

      // SDV normalisation: values > 1 are whole-number percentages, divide by 100
      let sdvPct = sdvCol >= 0 && row[sdvCol] != null ? Number(row[sdvCol]) : null;
      if (sdvPct != null && !isNaN(sdvPct) && sdvPct > 1.0) {
        sdvPct = sdvPct / 100;
        if (!sdvNormalisedSites.has(id)) {
          notices.push(`Data quality: SDV% values for ${id.replace('SITE-', 'Site ')} appear to be whole-number percentages and have been normalised (÷100).`);
          sdvNormalisedSites.add(id);
        }
      }

      const deviations = devCol >= 0 && row[devCol] != null ? Number(row[devCol]) : 0;
      const visitDate  = visitCol >= 0 ? parseExcelDate(row[visitCol]) : null;

      if (!qualBySite[id]) qualBySite[id] = [];
      qualBySite[id].push({
        date:         monthFirst,
        queriesAged:  isNaN(queriesAged) ? 0 : queriesAged,
        sdvPct:       sdvPct != null && !isNaN(sdvPct) ? sdvPct : null,
        deviations:   isNaN(deviations) ? 0 : deviations,
        monitoringVisitDate: visitDate,
      });
    }
  }

  // ── Merge into site objects ─────────────────────────────────────────────
  const allSiteIds = new Set([
    ...Object.keys(contactMap),
    ...Object.keys(enrolBySite),
    ...Object.keys(qualBySite),
  ]);

  // Cross-sheet validation: enrolment sites without contact records
  for (const id of Object.keys(enrolBySite)) {
    if (!contactMap[id]) {
      notices.push(`${id.replace('SITE-', 'Site ')} has enrolment data but no contact record — coordinator details unavailable.`);
    }
  }

  const sites = {};
  for (const id of allSiteIds) {
    const contact      = contactMap[id] || {};
    const enrolMonths  = (enrolBySite[id] || []).sort((a, b) => a.date - b.date);
    const qualMonths   = (qualBySite[id]  || []).sort((a, b) => a.date - b.date);
    const dateActivated = contact.dateActivated || null;
    const activationMonthStart = dateActivated
      ? new Date(dateActivated.getFullYear(), dateActivated.getMonth(), 1)
      : null;

    // Rule 3 — impute missing targets using modal value
    const allTargets = enrolMonths.map(m => m.target).filter(t => t != null);
    const modal = modalValue(allTargets);
    let targetImputedFlag = false;
    const filteredEnrolMonths = enrolMonths.map(m => {
      if (m.target == null && modal != null) {
        if (!targetImputedFlag) {
          notices.push(`Data quality: ${id.replace('SITE-', 'Site ')} had a missing monthly target — imputed using modal target (${modal}).`);
          targetImputedFlag = true;
        }
        return { ...m, target: modal, targetImputed: true };
      }
      return m;
    });

    // Rule 4 — filter out months before activation date
    const activeEnrolMonths = activationMonthStart
      ? filteredEnrolMonths.filter(m => m.date >= activationMonthStart)
      : filteredEnrolMonths;

    const activeQualMonths = activationMonthStart
      ? qualMonths.filter(m => m.date >= activationMonthStart)
      : qualMonths;

    // Last monitoring visit: max of contact sheet + quality sheet dates
    let lastVisit = contact.lastMonitoringVisit || null;
    for (const qm of activeQualMonths) {
      if (qm.monitoringVisitDate && (!lastVisit || qm.monitoringVisitDate > lastVisit)) {
        lastVisit = qm.monitoringVisitDate;
      }
    }

    // Merge enrol + quality months by first-of-month key
    const monthMap = {};
    for (const em of activeEnrolMonths) {
      monthMap[em.date.getTime()] = { ...em };
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

    // Raw string notes from contact + enrolment sheets
    const siteNotes = [
      ...(contact.notes || []),
      ...activeEnrolMonths.flatMap(m => m.notes || []),
    ].filter(n => n && typeof n === 'string' && n.trim());

    sites[id] = {
      id,
      rawName:   id.replace('SITE-', 'Site '),
      hospital:  contact.hospital || '',
      pi:        contact.pi        || { name: '', email: '' },
      coordinator: contact.coordinator || { name: '', email: '' },
      dateActivated,
      lastMonitoringVisit: lastVisit,
      months,
      notes: siteNotes,
      dataQualityFlags: [],
    };

    if (activeEnrolMonths.some(m => m.targetImputed)) sites[id].dataQualityFlags.push('target_imputed');
  }

  // Trial-level date range from all site months
  const allDates    = Object.values(sites).flatMap(s => s.months.map(m => m.date));
  const dataStart   = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const dataEnd     = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);

  const trialMeta = {
    trialName,
    sponsor,
    indication,
    totalTarget:    totalTarget || 120,
    requiredRunRate,
    monthsRemainingFromSheet,   // direct from Trial Overview (e.g. 4)
    targetCompletionDate,
    trialStartDate,
    dataStart,
    dataEnd: dataEndMonth,
  };

  return { sites, notices, trialMeta };
}
