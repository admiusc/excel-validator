// ─── Levenshtein distance ─────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ─── Missing-data responses ───────────────────────────────────────────────────
// Per client direction: "Si toda la información faltante o vacía sería error".
// These explicitly mean "no data was recorded" and are flagged as missing.
// IMPORTANT: "No aplica" / "Ninguno" are NOT here — those are valid contextual answers
// (e.g. "If you don't work, what's your job?" → "No aplica" is a valid answer).
const MISSING_RESPONSES = [
  'no registra','noregistra','sin registro','sr',
  'no informa','no informó','no informo','no refiere',
  'no sabe','no sabe.','no responde','no respondió','no respondio',
  'desconoce','desconocido','desconocida',
  'pendiente','por definir','pd',
  'sn','s/n','nsnr','ns/nr',
  'sin informacion','sin información','sin datos',
];

// ─── Truly non-informative / nonsense responses ───────────────────────────────
// Bad-quality answers that fail to answer the question (different from "missing data").
const NON_INFORMATIVE = [
  'no se','no sé','nose','nosé',
  'porque','porque si','porque sí','pq','pq si','pq sí',
  'xxx','xxxx','xxxxx','???','????','??','...','-','--','.',
  'asd','asdf','asdfg','qwerty','aaaa','bbbb','zzzz',
  'jajaja','jejeje','jeje','jaja','jiji',
  'cualquier cosa','cualquiera','lo que sea','what','que',
];

// ─── 1. Name ──────────────────────────────────────────────────────────────────
function validateName(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();

  if (/\d/.test(v)) {
    return { valid: false, category: 'name',
      error: `El campo de nombre contiene números: "${v}". Verificar si el dato está en la columna correcta.`,
      suggestion: null };
  }

  const words = v.split(/\s+/).filter(Boolean);
  const connectors = new Set(['de','del','la','las','los','y','e','i']);
  const isTitleCase = words.every(w =>
    connectors.has(w.toLowerCase()) || /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]*$/.test(w)
  );

  if (!isTitleCase) {
    const suggestion = toTitleCase(v);
    return { valid: false, category: 'name',
      error: `Nombre no está en formato título (cada palabra con mayúscula inicial). Ej: "Juan García" no "JUAN GARCIA" ni "juan garcia".`,
      suggestion };
  }
  return null;
}

function toTitleCase(str) {
  const connectors = new Set(['de','del','la','las','los','y','e','i']);
  return str.toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && connectors.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// ─── 2. ID / Cédula ───────────────────────────────────────────────────────────
function validateId(value) {
  // Empty IDs ARE flagged — this is the critical missing data the client cares about
  if (!value || value.trim() === '') {
    return { valid: false, category: 'id',
      error: `Falta el número de cédula / documento de identidad. Este es un dato obligatorio.`,
      suggestion: null };
  }
  const v = value.trim();

  // Scientific notation (e.g. 1.112E+10 — Excel converts large numbers)
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(v)) {
    const num = parseFloat(v);
    const suggestion = Number.isFinite(num) ? String(Math.round(num)) : null;
    return { valid: false, category: 'id',
      error: `Excel convirtió la cédula a notación científica (${v}). El número real es: ${suggestion || 'desconocido'}.`,
      suggestion };
  }

  const digits = v.replace(/[\s\-\.]/g, '');

  if (!/^\d+$/.test(digits)) {
    return { valid: false, category: 'id',
      error: `La cédula contiene caracteres no numéricos: "${v}". Solo se permiten dígitos.`,
      suggestion: digits.replace(/\D/g, '') || null };
  }

  if (digits.length < 5 || digits.length > 12) {
    return { valid: false, category: 'id',
      error: `Longitud de cédula inusual: ${digits.length} dígitos (se esperan entre 5 y 12). Verificar el número.`,
      suggestion: null };
  }

  return null;
}

// ─── 3. Date ──────────────────────────────────────────────────────────────────
function validateDate(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();

  // Excel serial number
  if (/^\d{4,5}$/.test(v)) {
    const serial = parseInt(v);
    if (serial > 1000 && serial < 60000) {
      const date = excelSerialToDate(serial);
      const formatted = formatDate(date);
      return { valid: false, category: 'date',
        error: `Excel guardó la fecha como número serial (${v}). La fecha real es: ${formatted}.`,
        suggestion: formatted };
    }
  }

  const datePatterns = [
    { regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/, fn: m => new Date(+m[3], +m[2]-1, +m[1]) },
    { regex: /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, fn: m => new Date(+m[1], +m[2]-1, +m[3]) },
    { regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/,  fn: m => new Date(+m[3]+1900+(+m[3]<30?100:0), +m[2]-1, +m[1]) },
  ];

  for (const { regex, fn } of datePatterns) {
    const m = v.match(regex);
    if (m) {
      const d = fn(m);
      if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) {
        return { valid: false, category: 'date',
          error: `La fecha "${v}" está fuera del rango válido (1900-2100) o tiene un día/mes imposible.`,
          suggestion: null };
      }
      const normalized = formatDate(d);
      if (normalized !== v) {
        return { valid: false, category: 'date',
          error: `Formato de fecha no estándar: "${v}". El formato esperado es DD/MM/AAAA.`,
          suggestion: normalized };
      }
      return null;
    }
  }

  return { valid: false, category: 'date',
    error: `Formato de fecha no reconocido: "${v}". Se esperaba DD/MM/AAAA (ej: 15/03/2010).`,
    suggestion: null };
}

function excelSerialToDate(serial) {
  const epoch = new Date(1899, 11, 30);
  epoch.setDate(epoch.getDate() + serial);
  return epoch;
}
function formatDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ─── 4. Email ─────────────────────────────────────────────────────────────────
function validateEmail(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v)) {
    return { valid: false, category: 'email',
      error: `Correo electrónico inválido: "${v}". Formato esperado: nombre@dominio.com.`,
      suggestion: null };
  }
  return null;
}

// ─── 5. Phone ─────────────────────────────────────────────────────────────────
function validatePhone(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();
  const digits = v.replace(/[\s\-\(\)\+\.]/g, '');
  const local   = digits.startsWith('57') && digits.length > 10 ? digits.slice(2) : digits;

  if (!/^\d+$/.test(local)) {
    return { valid: false, category: 'phone',
      error: `El teléfono contiene caracteres no permitidos: "${v}". Solo se aceptan dígitos, espacios o guiones.`,
      suggestion: local.replace(/\D/g, '') || null };
  }
  if (local.length === 10 && local.startsWith('3')) return null; // OK
  if (local.length === 7) {
    return { valid: false, category: 'phone',
      error: `Teléfono fijo sin indicativo de ciudad (7 dígitos). Agregar el indicativo (ej: 2 para Cali → 2XXXXXXX).`,
      suggestion: null };
  }
  if (local.length === 10 && !local.startsWith('3')) {
    return { valid: false, category: 'phone',
      error: `El número no parece un celular colombiano: "${v}". Los celulares comienzan con 3 (ej: 3001234567).`,
      suggestion: null };
  }
  return { valid: false, category: 'phone',
    error: `Teléfono con longitud inusual: ${local.length} dígito${local.length!==1?'s':''}. Un celular colombiano tiene 10 dígitos.`,
    suggestion: null };
}

// ─── 6. Barrio ────────────────────────────────────────────────────────────────
// Only basic format checks — no external list. Standardization (variants of same name)
// is handled column-wide by the processor.
function validateBarrio(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();

  if (v.length < 3) {
    return { valid: false, category: 'barrio',
      error: `Nombre de barrio muy corto: "${v}". Verificar si es un nombre real (mínimo 3 caracteres).`,
      suggestion: null };
  }

  const digitCount = (v.match(/\d/g) || []).length;
  if (digitCount >= 4) {
    return { valid: false, category: 'barrio',
      error: `El barrio "${v}" contiene ${digitCount} dígitos. ¿Es un nombre o es un número de identificación / dirección?`,
      suggestion: null };
  }

  // Check for excessive leading whitespace in the original (already trimmed at parser level,
  // but flag if value contains internal anomalies)
  if (/\s{3,}/.test(value)) {
    return { valid: false, category: 'barrio',
      error: `El barrio tiene espacios en exceso: "${value}". Eliminar espacios extra.`,
      suggestion: v.replace(/\s+/g, ' ') };
  }

  return null;
}

// ─── 7. City ──────────────────────────────────────────────────────────────────
function validateCity(value) {
  if (!value || value.trim() === '') return null;
  const v = value.trim();

  if (v.length < 3) {
    return { valid: false, category: 'city',
      error: `Nombre de ciudad muy corto: "${v}". Verificar nombre (mínimo 3 caracteres).`,
      suggestion: null };
  }

  const digitCount = (v.match(/\d/g) || []).length;
  if (digitCount >= 4) {
    return { valid: false, category: 'city',
      error: `La ciudad "${v}" contiene ${digitCount} dígitos. Verificar nombre.`,
      suggestion: null };
  }

  if (/\s{3,}/.test(value)) {
    return { valid: false, category: 'city',
      error: `La ciudad tiene espacios en exceso: "${value}".`,
      suggestion: v.replace(/\s+/g, ' ') };
  }

  return null;
}

// ─── 8. Scale (1-5) ───────────────────────────────────────────────────────────
function validateScale(value) {
  if (!value || value.trim() === '') return null;
  const v   = value.trim();
  const num = Number(v);

  if (isNaN(num)) {
    return { valid: false, category: 'scale',
      error: `Se esperaba un número del 1 al 5, pero se encontró texto: "${v}".`,
      suggestion: null };
  }
  if (!Number.isInteger(num) || num < 1 || num > 5) {
    return { valid: false, category: 'scale',
      error: `El valor ${v} está fuera del rango válido (1 a 5).`,
      suggestion: null };
  }
  return null;
}

// ─── 9. Non-informative ───────────────────────────────────────────────────────
function validateNonInformative(value) {
  if (!value || value.trim() === '') return null;
  const vNorm = normalize(value.trim());

  if (NON_INFORMATIVE.some(ni => normalize(ni) === vNorm)) {
    return { valid: false, category: 'noinfo',
      error: `Respuesta sin sentido o inconsistente: "${value.trim()}". Verificar y completar con un dato válido.`,
      suggestion: null };
  }
  return null;
}

// ─── 10. Missing data ─────────────────────────────────────────────────────────
// Catches both empty cells and explicit "no data" responses like "No registra".
const MISSING_NORMALIZED = new Set(MISSING_RESPONSES.map(normalize));

function validateMissing(value, hasType) {
  // Empty cells: only flag in typed columns (where data is expected)
  if (!value || value.trim() === '') {
    if (hasType) {
      return { valid: false, category: 'missing',
        error: `Campo vacío — falta el dato. Si no aplica, indicarlo explícitamente o completar.`,
        suggestion: null };
    }
    return null;
  }

  // Explicit "missing" responses: flag everywhere
  const norm = normalize(value.trim());
  if (MISSING_NORMALIZED.has(norm)) {
    return { valid: false, category: 'missing',
      error: `Dato no registrado: "${value.trim()}". Verificar si es posible completar la información.`,
      suggestion: null };
  }
  return null;
}

// ─── 11. Age (Edad) ───────────────────────────────────────────────────────────
function validateAge(value) {
  if (!value || value.trim() === '') return null; // missing handled separately
  const v = value.trim();

  // Pure number → check range
  if (/^\d+$/.test(v)) {
    const num = parseInt(v);
    if (num < 0 || num > 120) {
      return { valid: false, category: 'age',
        error: `Edad fuera del rango razonable: ${num}. Verificar.`,
        suggestion: null };
    }
    return null;
  }

  // Has digits with extra text (e.g. "14 años")
  const m = v.match(/(\d+)/);
  if (m) {
    const num = parseInt(m[1]);
    if (num >= 0 && num <= 120) {
      return { valid: false, category: 'age',
        error: `La edad debe ser solo un número, pero se encontró "${v}". Usar solo números (ej: ${num}).`,
        suggestion: String(num) };
    }
  }

  return { valid: false, category: 'age',
    error: `La edad debe ser un número entero (ej: 14, 16). Se encontró: "${v}".`,
    suggestion: null };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
const VALIDATORS = {
  name:   validateName,
  id:     validateId,
  date:   validateDate,
  email:  validateEmail,
  phone:  validatePhone,
  barrio: validateBarrio,
  city:   validateCity,
  scale:  validateScale,
  age:    validateAge,
};

module.exports = { VALIDATORS, validateNonInformative, validateMissing, toTitleCase };
