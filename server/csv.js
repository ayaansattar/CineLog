/**
 * Minimal CSV parser that supports quoted fields with embedded commas/newlines.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const input = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
    } else if (ch === '\r') {
      // ignore; handle \r\n via \n
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => String(h).trim());
  const records = rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = cells[idx] != null ? String(cells[idx]).trim() : '';
    });
    return obj;
  });

  return { headers, records };
}

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const name of candidates) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Map Letterboxd CSV rows into importable entries.
 * Supports watched/diary (Date,Name,Year,Letterboxd URI) and ratings (+ Rating).
 */
export function mapLetterboxdRows(csvText) {
  const { headers, records } = parseCsv(csvText);
  if (!headers.length) {
    const err = new Error('CSV is empty');
    err.status = 400;
    throw err;
  }

  const nameCol = findColumn(headers, ['Name', 'Title']);
  const yearCol = findColumn(headers, ['Year']);
  const ratingCol = findColumn(headers, ['Rating']);
  const dateCol = findColumn(headers, ['Date', 'Watched Date']);

  if (!nameCol) {
    const err = new Error('CSV must include a Name (or Title) column');
    err.status = 400;
    throw err;
  }

  const items = [];
  for (const record of records) {
    const title = (record[nameCol] || '').trim();
    if (!title) continue;

    const yearRaw = yearCol ? record[yearCol] : '';
    const yearNum = yearRaw ? Number(yearRaw) : null;
    const year = Number.isFinite(yearNum) ? yearNum : null;

    let rating = null;
    if (ratingCol && record[ratingCol] !== '' && record[ratingCol] != null) {
      const r = Number(record[ratingCol]);
      if (Number.isFinite(r) && r >= 0.5 && r <= 5) {
        // Letterboxd ratings are already 0.5–5
        rating = Math.round(r * 2) / 2;
      }
    }

    let watchedAt = null;
    if (dateCol && record[dateCol]) {
      const d = new Date(record[dateCol]);
      if (!Number.isNaN(d.getTime())) watchedAt = d.toISOString();
    }

    items.push({ title, year, rating, watchedAt });
  }

  return items;
}
