const { detectColumnsWithSubHeaders } = require('./columnDetector');
const { VALIDATORS, validateNonInformative, validateMissing } = require('./validators');

const CATEGORY_LABELS = {
  name:        'Nombres',
  id:          'Cédulas / Documentos',
  date:        'Fechas',
  email:       'Correos Electrónicos',
  phone:       'Teléfonos',
  barrio:      'Barrios / Sectores',
  city:        'Ciudades / Municipios',
  scale:       'Escalas (1-5)',
  age:         'Edades',
  missing:     'Datos Faltantes',
  noinfo:      'Respuestas Sin Sentido',
  standardize: 'Variaciones de escritura',
};

// Columns where we run standardization detection (intra-column variant check)
const STANDARDIZABLE_TYPES = new Set(['barrio', 'city']);

// Explicit allow-list of CONTEXTUAL valid responses (per client direction).
// "No aplica" / "Ninguno" are valid because they answer the question (e.g. "If you work,
// what activity?" → "No aplica" if you don't work). They are NOT missing data.
// Anything that means "not recorded" (no registra, sin información…) is handled by validateMissing.
const ALWAYS_VALID_RESPONSES = new Set([
  'no aplica', 'no aplica.', 'noaplica',
  'ninguno', 'ninguna', 'ninguno.', 'ninguna.',
  'no tiene', 'no hay',
  'na', 'n/a',
]);

function isAlwaysValidResponse(value) {
  if (!value) return false;
  const norm = String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return ALWAYS_VALID_RESPONSES.has(norm);
}

function processData({ headers, mainHeaders, subHeaders, rows }) {
  const columnTypes = detectColumnsWithSubHeaders(
    mainHeaders || headers,
    subHeaders || null
  );

  // 1. First pass: cell-level type validation + non-informative check
  const processedRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const cell = { value, valid: true, error: null, suggestion: null, category: null };
      const colType = columnTypes[colIndex];

      // 1. Allow-list FIRST — "No aplica" / "Ninguno" are valid responses, never flagged.
      if (value && isAlwaysValidResponse(value)) return cell;

      // 2. Missing-data check — empty cells in typed columns + explicit "no registra" markers.
      const missingResult = validateMissing(value, !!colType);
      if (missingResult) {
        cell.valid    = false;
        cell.error    = missingResult.error;
        cell.category = 'missing';
        return cell;
      }

      // (Empty + non-typed column → not flagged, just left blank)
      if (!value || value.trim() === '') return cell;

      // 3. Nonsense responses ("no sé", "xxx", "asdf") — flagged anywhere.
      const niResult = validateNonInformative(value);
      if (niResult) {
        cell.valid    = false;
        cell.error    = niResult.error;
        cell.category = 'noinfo';
        return cell;
      }

      // 4. Type-specific validators only apply to typed columns.
      if (colType && VALIDATORS[colType]) {
        const result = VALIDATORS[colType](value);
        if (result) {
          cell.valid      = false;
          cell.error      = result.error;
          cell.suggestion = result.suggestion || null;
          cell.category   = result.category;
        }
      }

      return cell;
    });

    return { index: rowIndex, cells, hasErrors: cells.some(c => !c.valid) };
  });

  // 2. Second pass: column-wide standardization detection
  // For barrio/city columns, find values that are the same when normalized but written differently.
  applyStandardization(processedRows, headers, columnTypes);

  // 3. Recompute hasErrors after standardization additions
  for (const row of processedRows) row.hasErrors = row.cells.some(c => !c.valid);

  // 4. Aggregate stats
  const errorsByCategory = {};
  let totalErrors = 0;
  for (const row of processedRows) {
    for (const cell of row.cells) {
      if (!cell.valid) {
        totalErrors++;
        const cat = cell.category || 'other';
        errorsByCategory[cat] = (errorsByCategory[cat] || 0) + 1;
      }
    }
  }

  const totalRows      = rows.length;
  const rowsWithErrors = processedRows.filter(r => r.hasErrors).length;

  const categorySummary = Object.entries(errorsByCategory)
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    stats: { totalRows, rowsWithErrors, validRows: totalRows - rowsWithErrors, totalErrors, errorsByCategory },
    headers,
    columnTypes,
    categorySummary,
    rows: processedRows,
  };
}

// ─── Standardization (variant detection) ─────────────────────────────────────

function normalizeForGroup(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function applyStandardization(processedRows, headers, columnTypes) {
  const headerCount = headers.length;

  for (let col = 0; col < headerCount; col++) {
    const colType = columnTypes[col];
    if (!STANDARDIZABLE_TYPES.has(colType)) continue;

    // Group all valid values by their normalized form
    const groups = {};
    for (const row of processedRows) {
      const cell = row.cells[col];
      if (!cell || !cell.value || !cell.value.trim()) continue;
      // Only consider cells that passed format validation (i.e. ones already invalid stay invalid)
      const variant = cell.value.trim();
      const norm    = normalizeForGroup(variant);
      if (!norm) continue;
      if (!groups[norm]) groups[norm] = {};
      groups[norm][variant] = (groups[norm][variant] || 0) + 1;
    }

    // For each group with multiple distinct variants, pick a canonical form
    for (const [norm, variants] of Object.entries(groups)) {
      const variantList = Object.entries(variants);
      if (variantList.length < 2) continue;

      // Sort: most frequent first; tiebreak by Title-Case form
      variantList.sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const aTitle = isTitleCase(a[0]) ? 0 : 1;
        const bTitle = isTitleCase(b[0]) ? 0 : 1;
        return aTitle - bTitle;
      });

      const canonical = variantList[0][0];

      // Mark all non-canonical variants as needing standardization
      for (const row of processedRows) {
        const cell = row.cells[col];
        if (!cell || !cell.value) continue;
        const variant = cell.value.trim();
        if (normalizeForGroup(variant) !== norm) continue;
        if (variant === canonical) continue;
        // Don't overwrite a more important error
        if (!cell.valid && cell.category !== 'standardize') continue;

        cell.valid      = false;
        cell.category   = 'standardize';
        cell.error      = `Variación de escritura: "${variant}". En el archivo aparece más frecuentemente como "${canonical}".`;
        cell.suggestion = canonical;
      }
    }
  }
}

function isTitleCase(s) {
  return /^[A-ZÁÉÍÓÚÜÑ]/.test(s) && !/^[A-ZÁÉÍÓÚÜÑ\s]+$/.test(s);
}

module.exports = { processData };
