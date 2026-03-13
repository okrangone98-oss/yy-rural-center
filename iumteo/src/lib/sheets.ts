export type CsvRecord = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      const hasValue = row.some((value) => String(value || '').trim() !== '');
      if (hasValue) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    const hasValue = row.some((value) => String(value || '').trim() !== '');
    if (hasValue) rows.push(row);
  }

  return rows;
}

export function normalizeHeader(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return String(value || '').replace(/\D+/g, '');
}

export function rowsToRecords(rows: string[][]): CsvRecord[] {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));

  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      record[header] = String(row[idx] || '').trim();
    });
    return record;
  });
}

export function pickByAliases(record: CsvRecord, aliases: string[]): string {
  for (const alias of aliases) {
    const key = Object.keys(record).find((header) => header === alias || header.replace(/\s+/g, '') === alias.replace(/\s+/g, ''));
    if (key && record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
      return String(record[key]).trim();
    }
  }
  return '';
}
