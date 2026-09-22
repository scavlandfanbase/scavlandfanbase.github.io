// Minimal RFC4180-style CSV read/write with no external dependencies.
const fs = require('node:fs');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      // ignore, \n handles the line break
    } else if (char === '\n') {
      pushField(); pushRow();
    } else {
      field += char;
    }
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  while (rows.length && rows[rows.length - 1].every(cell => cell === '')) rows.pop();
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map(cells => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = cells[index] ?? ''; });
    return obj;
  });
}

function escapeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCSV(rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(header => escapeCell(row[header])).join(','));
  return lines.join('\r\n') + '\r\n';
}

function readCSVFile(path) {
  return parseCSV(fs.readFileSync(path, 'utf8'));
}

function writeCSVFile(path, rows, headers) {
  fs.writeFileSync(path, toCSV(rows, headers));
}

module.exports = { parseCSV, toCSV, readCSVFile, writeCSVFile };
