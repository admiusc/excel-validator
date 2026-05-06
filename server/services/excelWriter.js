const ExcelJS = require('exceljs');

async function generateCorrectedExcel(originalBuffer, validationResult) {
  const { headers, rows, columnTypes } = validationResult;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Datos Corregidos');

  // Header row styling
  const headerStyle = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2F57' } },
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FF6366F1' } },
      bottom: { style: 'thin', color: { argb: 'FF6366F1' } },
    },
  };

  // Add headers + Observaciones column
  const allHeaders = [...headers, 'Observaciones'];
  const headerRow = sheet.addRow(allHeaders);
  headerRow.height = 30;
  headerRow.eachCell(cell => Object.assign(cell, headerStyle));

  // Column widths
  sheet.columns = allHeaders.map((h, i) => ({
    key: String(i),
    width: i === allHeaders.length - 1 ? 50 : Math.min(Math.max(h.length + 4, 12), 35),
  }));

  // Data rows
  for (const row of rows) {
    const observations = [];
    const rowValues = row.cells.map((cell, colIndex) => {
      if (!cell.valid && cell.suggestion) {
        observations.push(`[${headers[colIndex] || colIndex}] ${cell.error} → sugerido: "${cell.suggestion}"`);
        return cell.suggestion; // use corrected value
      }
      if (!cell.valid) {
        observations.push(`[${headers[colIndex] || colIndex}] ${cell.error}`);
      }
      return cell.value;
    });
    rowValues.push(observations.join(' | '));

    const dataRow = sheet.addRow(rowValues);
    dataRow.height = 18;

    // Style each cell
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colIdx = colNumber - 1;
      const cellData = row.cells[colIdx];

      cell.alignment = { vertical: 'middle', wrapText: false };

      if (cellData && !cellData.valid) {
        // Red fill for errors
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E4' } };
        cell.font = { color: { argb: 'FFCC0000' } };
      } else if (colIdx < row.cells.length) {
        // Alternate row colors
        const isEven = (row.index % 2 === 0);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFAFAFA' : 'FFF0F4FF' } };
      }

      // Observaciones column styling
      if (colNumber === allHeaders.length) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } };
        cell.font = { color: { argb: 'FF856404' }, size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: allHeaders.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { generateCorrectedExcel };
