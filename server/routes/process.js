const express = require('express');
const multer = require('multer');
const { parseExcel } = require('../services/excelParser');
const { processData } = require('../services/processor');
const { generateCorrectedExcel } = require('../services/excelWriter');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ];
    const allowedExt = ['.xlsx', '.xls', '.xlsm'];
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
    }
  },
});

router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    // Parse Excel
    const parsed = parseExcel(req.file.buffer);

    // Validate data
    const result = processData(parsed);

    // Generate corrected Excel
    const correctedBuffer = await generateCorrectedExcel(req.file.buffer, result);
    const correctedBase64 = correctedBuffer.toString('base64');

    res.json({
      success: true,
      filename: req.file.originalname,
      stats: result.stats,
      headers: result.headers,
      columnTypes: result.columnTypes,
      categorySummary: result.categorySummary,
      rows: result.rows,
      correctedExcel: correctedBase64,
    });
  } catch (err) {
    console.error('Error procesando archivo:', err);
    res.status(500).json({ error: err.message || 'Error al procesar el archivo.' });
  }
});

module.exports = router;
