const BOM = '\uFEFF';
// Spreadsheet apps execute cells that start with these characters as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;
// Phone numbers such as "+91 98765 43210" start with "+" but can't call functions, so they're left readable.
const NUMERIC_ONLY = /^[+-]?[\d\s().-]+$/;

function cell(value) {
  let text = value == null ? '' : String(value);
  if (FORMULA_START.test(text) && !NUMERIC_ONLY.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds an RFC 4180 CSV string that Excel opens correctly (UTF-8 BOM, CRLF line endings).
 * `columns` is a list of { header, value: (row) => any }.
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
