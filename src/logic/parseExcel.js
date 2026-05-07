import * as XLSX from 'xlsx';

function normaliseSiteId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]$/.test(s)) return `SITE-${s}`;
  const m = s.match(/^SITE-?([A-Z])$/);
  if (m) return `SITE-${m[1]}`;
  return s;
}

function parseExcelDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
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

function colIdx(headers, ...fragments) {
  return headers.findIndex(h => fragments.every(f => h.includes(f.toLowerCase())));
}

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

  if (overviewRows.length > 0) {
    for (const row of overviewRows) {
      if (!row) continue;
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] == null) continue;
        const key = String(row[i]).toLowerCase().trim();
        const val = row[i + 1];
        if (!val && val !== 0) continue;
        if (key.includes('trial') && key.includes('name')) trialName = String(val);
        if (key.includes('sponsor')) sponsor = String(val);
        if (key.includes('indication') || key.includes('condition') || key.includes('disease')) indication = String(val);
        if (key.includes('total') && key.includes('target')) totalTarget = Number(val) || null;
        if (key.includes('required') || (key.includes('run') && key.includes('rate'))) requiredRunRate = Number(val) || null;
        if (key.includes('completion') || (key.includes('target') && key.includes('date')) || key.includes('end date')) targetCompletionDate = parseExcelDate(val);
        if (key.includes('start') && key.includes('date')) trialStartDate = parseExcelDate(val);
      }
    }
  }

  // ── Site Contacts ───────────────────────────────────────────────────────
  const { rows: contactRows } = parseSheetRows(workbook, 'contact');
  const contactMap = {};
  if (contactRows.length > 1) {
    const hdr = contactRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol   = colIdx(hdr, 'site');
    const hospCol   = colIdx(hdr, 'hospital');
    const piNameCol = colIdxAny(hdr, ['pi', 'name'], ['investigator', 'name'], ['pi']);
    const piEmailCol = colIdxAny(hdr, ['pi', 'email'], ['investigator', 'email']);
    const coordNameCol = colIdxAny(hdr, ['coord', 'name'], ['coordinator', 'name'], ['coordinator']);
    const coordEmailCol = colIdxAny(hdr, ['coord', 'email'], ['coordinator', 'email']);
    const activatedCol = colIdxAny(hdr, ['activat'], ['activation']);
    const visitCol  = colIdxAny(hdr, ['last', 'visit'], ['monitor', 'visit'], ['last', 'monitor']);
    const notesCol  = colIdx(hdr, 'note');

    for (let i = 1; i < contactRows.length; i++) {
      const row = contactRows[i];
      if (!row || row[siteCol] == null) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;
      const rawNotes = notesCol >= 0 && row[notesCol] ? [String(row[notesCol])] : [];
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
        notes: rawNotes,
      };
    }
  }

  // ── Enrolment ───────────────────────────────────────────────────────────
  const { rows: enrolRows } = parseSheetRows(workbook, 'enrol');
  const enrolBySite = {};
  let siteBAliasFixed = false;

  if (enrolRows.length > 1) {
    const hdr = enrolRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol     = colIdx(hdr, 'site');
    const monthCol    = colIdx(hdr, 'month');
    const enrolledCol = colIdxAny(hdr, ['enroll'], ['enrolled'], ['patients enrolled']);
    const targetCol   = colIdx(hdr, 'target');
    const sfCol       = colIdxAny(hdr, ['screen fail'], ['screen_fail'], ['failure']);
    const notesCol    = colIdx(hdr, 'note');

    // Track site+month combos for duplicate detection
    const seenKeys = {};

    for (let i = 1; i < enrolRows.length; i++) {
      const row = enrolRows[i];
      if (!row || row[siteCol] == null) continue;
      const rawSiteId = String(row[siteCol]).trim();

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
        notices.push(`Duplicate enrolment records detected for ${id.replace('SITE-', 'Site ')} in ${formatMonthLabel(monthFirst)}. Only one monthly record per site should exist.`);
        continue;
      }
      seenKeys[dupeKey] = true;

      const enrolled = row[enrolledCol] != null ? Number(row[enrolledCol]) : null;
      const target = row[targetCol] != null && row[targetCol] !== '' ? Number(row[targetCol]) : null;
      const screenFailures = sfCol >= 0 && row[sfCol] != null ? Number(row[sfCol]) : 0;
      const rowNotes = notesCol >= 0 && row[notesCol] ? [String(row[notesCol])] : [];

      if (!enrolBySite[id]) enrolBySite[id] = [];
      enrolBySite[id].push({
        month: formatMonthLabel(monthFirst),
        date: monthFirst,
        enrolled: isNaN(enrolled) ? 0 : (enrolled || 0),
        target,
        screenFailures: isNaN(screenFailures) ? 0 : screenFailures,
        notes: rowNotes,
      });
    }
  }

  // ── SDV & Quality ───────────────────────────────────────────────────────
  const { rows: qualRows } = parseSheetRows(workbook, 'qual');
  const qualBySite = {};
  const sdvNormalisedSites = new Set();

  if (qualRows.length > 1) {
    const hdr = qualRows[0].map(h => String(h || '').trim().toLowerCase());
    const siteCol = colIdx(hdr, 'site');
    const monthCol = colIdx(hdr, 'month');

    // More robust query column: prefer ">14 days" or "aged" over generic "queries"
    const queriesCol = colIdxAny(
      hdr,
      ['quer', '14'],
      ['aged'],
      ['queries open', 'quer'],
    );

    const sdvCol = colIdxAny(hdr, ['sdv'], ['source data']);
    const devCol = colIdxAny(hdr, ['deviat'], ['protocol']);
    const visitCol = colIdxAny(hdr, ['last', 'visit'], ['monitor', 'visit'], ['last', 'monitor']);

    const seenQualKeys = {};

    for (let i = 1; i < qualRows.length; i++) {
      const row = qualRows[i];
      if (!row || row[siteCol] == null) continue;
      const id = normaliseSiteId(row[siteCol]);
      if (!id) continue;

      const rawMonth = row[monthCol];
      const monthDate = parseExcelDate(rawMonth);
      if (!monthDate) continue;
      const monthFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

      // Duplicate quality records
      const dupeKey = `${id}::${monthFirst.getTime()}`;
      if (seenQualKeys[dupeKey]) continue;
      seenQualKeys[dupeKey] = true;

      const queriesAged = queriesCol >= 0 && row[queriesCol] != null ? Number(row[queriesCol]) : 0;

      // SDV normalisation (whole number % → decimal)
      let sdvPct = sdvCol >= 0 && row[sdvCol] != null ? Number(row[sdvCol]) : null;
      if (sdvPct != null && !isNaN(sdvPct) && sdvPct > 1.0) {
        sdvPct = sdvPct / 100;
        if (!sdvNormalisedSites.has(id)) {
          notices.push(`Data quality: SDV% values for ${id.replace('SITE-', 'Site ')} appear to be whole-number percentages and have been normalised (divided by 100).`);
          sdvNormalisedSites.add(id);
        }
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
    const contact = contactMap[id] || {};
    const enrolMonths = (enrolBySite[id] || []).sort((a, b) => a.date - b.date);
    const qualMonths  = (qualBySite[id]  || []).sort((a, b) => a.date - b.date);
    const dateActivated = contact.dateActivated || null;
    const activationMonthStart = dateActivated
      ? new Date(dateActivated.getFullYear(), dateActivated.getMonth(), 1)
      : null;

    // Rule 3 — impute missing targets
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

    // Rule 4 — filter out months before activation
    const activeEnrolMonths = activationMonthStart
      ? filteredEnrolMonths.filter(m => m.date >= activationMonthStart)
      : filteredEnrolMonths;

    const activeQualMonths = activationMonthStart
      ? qualMonths.filter(m => m.date >= activationMonthStart)
      : qualMonths;

    // Determine last monitoring visit from contact + quality sheets
    let lastVisit = contact.lastMonitoringVisit || null;
    for (const qm of activeQualMonths) {
      if (qm.monitoringVisitDate && (!lastVisit || qm.monitoringVisitDate > lastVisit)) {
        lastVisit = qm.monitoringVisitDate;
      }
    }

    // Merge enrol + quality months by date (first of month key)
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

    // Collect raw string notes from contact + enrolment sheets
    const siteNotes = [
      ...(contact.notes || []),
      ...activeEnrolMonths.flatMap(m => m.notes || []),
    ].filter(n => n && typeof n === 'string' && n.trim());

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
  }

  // Calculate trial-level metadata
  const allDates = Object.values(sites).flatMap(s => s.months.map(m => m.date));
  const dataStart = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const dataEnd   = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  const dataEndMonth = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 0);

  const trialMeta = {
    trialName,
    sponsor,
    indication,
    totalTarget: totalTarget || 120,
    requiredRunRate,
    targetCompletionDate,
    trialStartDate,
    dataStart,
    dataEnd: dataEndMonth,
  };

  return { sites, notices, trialMeta };
}
