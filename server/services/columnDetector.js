const PATTERNS = {
  name: [
    /nombres?\s*(y\s*apellidos?)?/i,
    /apellidos?(\s*y\s*nombres?)?/i,
    /nombre\s*completo/i,
    /^nombre$/i,
  ],
  id: [
    /c[eé]dula/i,
    /n[uú]m(ero)?\s*de\s*(documento|identificaci[oó]n)/i,
    /identificaci[oó]n/i,
    /documento\s*de\s*identidad/i,
    /documento/i,
    /\bcc\b/i,
    /\bnit\b/i,
  ],
  date: [
    /fecha\s*de\s*nacimiento/i,
    /fecha\s*de\s*ingreso/i,
    /fecha\s*de\s*egreso/i,
    /fecha\s*de\s*vinculaci[oó]n/i,
    /fecha\s*de\s*diligenciamiento/i,
    /^fecha$/i,
    /f\.\s*nac/i,
  ],
  email: [
    /correo\s*(electr[oó]nico)?/i,
    /e-?mail/i,
    /\bmail\b/i,
  ],
  phone: [
    /tel[eé]fono/i,
    /celular/i,
    /m[oó]vil/i,
    /\bcel\b/i,
    /\btel\b/i,
    /n[uú]mero\s*de\s*contacto/i,  // specific phrase only — NOT bare /contacto/
  ],
  barrio: [
    /barrio/i,
    /\bsector\b/i,
    /vereda/i,
    /urbanizaci[oó]n/i,
    /barrio\s*[\/\-]\s*localidad/i,
    /localidad/i,
  ],
  city: [
    /\bciudad\b/i,
    /municipio/i,
    /ciudad\s*de\s*residencia/i,
  ],
  scale: [
    /escala/i,
    /puntaje/i,
    /calificaci[oó]n/i,
    /puntuaci[oó]n/i,
    /nivel\s*(de\s*)?(riesgo|atenci[oó]n|educaci[oó]n)/i,
    /rango/i,
    /sisb[eé]n/i,
    /estrato/i,
  ],
  age: [
    /^edad$/i,
    /\bedad\b/i,
    /a[ñn]os\s*cumplidos/i,
  ],
};

// Sub-headers that are date/time components — these should NOT inherit the parent column type
const DATE_COMPONENT_SUBS = /^(d[ií]a|mes|a[ñn]o|lugar|hora|semana|bimestre|trimestre)$/i;

// Sub-headers that are document type classifiers (not the actual ID number)
const DOC_TYPE_SUBS = /^(tipo|clase|modalidad|categor[ií]a)$/i;

// Headers that classify a TYPE / CLASS / CATEGORY rather than carry the data itself.
// e.g. "Tipo de Documento" → classifier (T.I., C.C., Permiso…), NOT a cédula number.
//      "Tipo de Vivienda", "Clase de…", "Modalidad de…" → same idea.
// Headers like "Documento de Identidad" or "Número de Documento" are NOT matched by this.
const TYPE_CLASSIFIER_HEADER = /^(tipo|clase|modalidad|categor[ií]a)\b/i;

/**
 * Count how many strings in the array match at least one known column-name pattern.
 * Used by excelParser to score candidate header rows.
 */
function countPatternMatches(strings) {
  return strings.filter(s =>
    s && Object.values(PATTERNS).some(patterns => patterns.some(p => p.test(String(s))))
  ).length;
}

/**
 * Detect column types using both the main header row and the optional sub-header row.
 * Skips date components (Día, Mes, Año) and doc-type classifiers (Tipo).
 */
function detectColumnsWithSubHeaders(mainHeaders, subHeaders) {
  const columnTypes = {};

  mainHeaders.forEach((header, index) => {
    if (!header) return;
    const headerTrim = header.normalize('NFC').trim();
    const sub        = subHeaders ? (subHeaders[index] || '') : '';
    const subTrim    = sub.normalize('NFC').trim();

    // Sub-header rule overrides main header (sub-headers have "autonomy")
    if (DATE_COMPONENT_SUBS.test(subTrim)) return;
    if (DOC_TYPE_SUBS.test(subTrim)) return;

    // Safety net: if the MAIN header itself is a date component (sub-header was misclassified
    // as main), still skip — values like "Día" or "Mes" must never be validated as anything.
    if (DATE_COMPONENT_SUBS.test(headerTrim)) return;
    if (DOC_TYPE_SUBS.test(headerTrim)) return;

    // Skip "Tipo de Documento", "Clase de Vivienda", etc. — these are classifier columns
    // whose values are short labels (T.I., C.C., Permiso de Residencia…), not data to validate.
    if (TYPE_CLASSIFIER_HEADER.test(headerTrim)) return;

    const testStr = subTrim ? `${headerTrim} - ${subTrim}` : headerTrim;

    for (const [type, patterns] of Object.entries(PATTERNS)) {
      if (patterns.some(p => p.test(testStr) || p.test(headerTrim))) {
        columnTypes[index] = type;
        break;
      }
    }
  });

  return columnTypes;
}

function detectColumns(headers) {
  return detectColumnsWithSubHeaders(headers, null);
}

module.exports = { detectColumns, detectColumnsWithSubHeaders, countPatternMatches };
