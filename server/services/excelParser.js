const XLSX = require('xlsx');
const { countPatternMatches } = require('./columnDetector');

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No se encontró ninguna hoja en el archivo.');
  }

  const sheet = findBestSheet(workbook);
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawData.length === 0) throw new Error('La hoja seleccionada está vacía.');

  expandMergedCells(rawData, sheet['!merges'] || []);

  // Strip leading fully-empty rows
  while (rawData.length > 0 && rowIsEmpty(rawData[0])) rawData.shift();
  if (rawData.length === 0) throw new Error('El archivo no tiene datos.');

  // 1. Find the actual column-header row
  const mainHeaderIdx = findMainHeaderRow(rawData);

  // 2. Look for a sub-header row right after (e.g. "Día / Mes / Año" under "Fecha de Nacimiento")
  const subHeaderIdx = findSubHeaderRow(rawData, mainHeaderIdx);

  const mainHeaders = rawData[mainHeaderIdx].map(h => String(h || '').trim());
  const subHeaders  = subHeaderIdx !== -1
    ? rawData[subHeaderIdx].map(h => String(h || '').trim())
    : null;

  // 3. Combined display headers
  const headers = buildCombinedHeaders(mainHeaders, subHeaders);

  // 4. Data starts right after the last header row
  const dataStartIdx = (subHeaderIdx !== -1 ? subHeaderIdx : mainHeaderIdx) + 1;

  const dataRows = rawData.slice(dataStartIdx).filter(row => !rowIsEmpty(row));

  if (dataRows.length === 0) {
    return { headers, mainHeaders, subHeaders, rows: [] };
  }

  const rows = dataRows.map(row =>
    headers.map((_, i) => {
      const val = row[i];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    })
  );

  return { headers, mainHeaders, subHeaders, rows };
}

// ─── Sheet selection ──────────────────────────────────────────────────────────

function findBestSheet(workbook) {
  let best = null;
  let bestScore = -1;

  for (const name of workbook.SheetNames) {
    const s = workbook.Sheets[name];
    if (!s || !s['!ref']) continue;

    const range  = XLSX.utils.decode_range(s['!ref']);
    const totalRows = range.e.r - range.s.r + 1;
    const totalCols = range.e.c - range.s.c + 1;

    let dataCells = 0, textCells = 0, numCells = 0;
    for (const key of Object.keys(s)) {
      if (key.startsWith('!')) continue;
      const cell = s[key];
      if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
      dataCells++;
      if (typeof cell.v === 'string' && cell.v.trim()) textCells++;
      if (typeof cell.v === 'number') numCells++;
    }

    const score = dataCells + textCells * 0.5 + numCells * 0.5
      + (totalCols >= 3 ? totalRows * 2 : 0);

    if (score > bestScore) { bestScore = score; best = s; }
  }

  return best || workbook.Sheets[workbook.SheetNames[0]];
}

// ─── Merged cell expansion ────────────────────────────────────────────────────

function expandMergedCells(data, merges) {
  for (const { s, e } of merges) {
    const base = data[s.r] && data[s.r][s.c] !== undefined ? data[s.r][s.c] : '';
    for (let r = s.r; r <= e.r; r++) {
      if (!data[r]) data[r] = [];
      for (let c = s.c; c <= e.c; c++) {
        if (r === s.r && c === s.c) continue;
        if (!data[r][c]) data[r][c] = base;
      }
    }
  }
}

// ─── Header row detection ─────────────────────────────────────────────────────

function findMainHeaderRow(data) {
  let bestRow   = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(12, data.length); i++) {
    const row      = data[i];
    const nonEmpty = row.filter(c => String(c || '').trim() !== '');
    if (nonEmpty.length < 2) continue;

    // KEY FIX: work with UNIQUE values only.
    // Title rows repeat one merged value across 20+ cols → 1 unique value → low score.
    // Section-number rows repeat a few numbers → low unique + no pattern matches.
    // Real header rows have many distinct column names → many unique + many pattern matches.
    const unique = [...new Set(nonEmpty.map(c => String(c).trim()))];

    // Skip rows where all values are the same (e.g. merged title row)
    if (unique.length === 1) continue;

    // Skip rows where all unique values are small integers (section-number rows)
    const allSmallIntegers = unique.every(u => /^\d{1,3}$/.test(u));
    if (allSmallIntegers) continue;

    // Count how many UNIQUE values match known column-name patterns
    const patternMatches = countPatternMatches(unique);

    // Penalize if unique values contain long numbers (IDs/phones → data rows)
    let penalty = 0;
    for (const u of unique) {
      if (/^\d{6,}$/.test(u)) penalty += 4;
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(u)) penalty += 3;
    }

    // Bonus for having several distinct text labels
    const textLabels = unique.filter(u => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(u) && u.length >= 3);
    const score = patternMatches * 10 + textLabels.length - penalty;

    if (score > bestScore) { bestScore = score; bestRow = i; }
  }

  return bestRow;
}

// Specific keywords that ALWAYS indicate a sub-header row when they appear together
const KNOWN_SUB_HEADER_WORDS = /^(d[ií]a|mes|a[ñn]o|lugar|tipo|n[uú]mero|hora|minuto|semana|bimestre|trimestre|inicial|final|desde|hasta|primer|segundo|tercer)$/i;

function findSubHeaderRow(data, mainHeaderIdx) {
  // Look at the next 1–2 rows after the main header (a filter/blank row may be in between)
  for (let offset = 1; offset <= 2; offset++) {
    const idx = mainHeaderIdx + offset;
    if (idx >= data.length) break;

    const row      = data[idx];
    const nonEmpty = row.filter(c => String(c || '').trim() !== '');
    if (nonEmpty.length < 2) continue; // skip blank/filter rows

    // PRIORITY 1: explicit known sub-header words (Día, Mes, Año, Lugar, Tipo, Número…)
    // If 2+ cells contain these specific words, it's definitely a sub-header row.
    const knownSubMatches = nonEmpty.filter(c =>
      KNOWN_SUB_HEADER_WORDS.test(String(c).normalize('NFC').trim())
    ).length;
    if (knownSubMatches >= 2) return idx;

    // PRIORITY 2: heuristic check — short alphabetic labels with no column patterns
    const unique = [...new Set(nonEmpty.map(c => String(c).trim()))];
    const patternMatches = countPatternMatches(unique);
    if (patternMatches > 1) continue;

    const alphaValues = nonEmpty.filter(c => /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\/]+$/.test(String(c).normalize('NFC').trim()));
    const alphaRatio  = alphaValues.length / nonEmpty.length;
    if (alphaRatio < 0.5) continue;

    const allShort      = nonEmpty.every(c => String(c).trim().length < 35);
    const noLongNumbers = nonEmpty.every(c => !/^\d{5,}/.test(String(c).trim()));

    if (allShort && noLongNumbers) return idx;
  }
  return -1;
}

// ─── Header combination ───────────────────────────────────────────────────────

function buildCombinedHeaders(mainHeaders, subHeaders) {
  return mainHeaders.map((main, i) => {
    const sub      = subHeaders ? (subHeaders[i] || '') : '';
    const mainTrim = main.trim();
    const subTrim  = sub.trim();

    if (mainTrim && subTrim && mainTrim !== subTrim) return `${mainTrim} - ${subTrim}`;
    if (subTrim && !mainTrim) return subTrim;
    return mainTrim || `Col ${i + 1}`;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowIsEmpty(row) {
  return !row || row.every(c => c === null || c === undefined || String(c).trim() === '');
}

module.exports = { parseExcel };
