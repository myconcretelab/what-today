import { Router } from 'express';
import dayjs from 'dayjs';
import { validateSaveReservationPayload } from '../validation.js';

export function createReservationRouter({
  sheetNames,
  spreadsheetId,
  getAccessToken,
  getSheetId,
  fetchFn
}) {
  const router = Router();
  const validGiteIds = new Set(Object.keys(sheetNames));

  router.post('/save-reservation', async (req, res) => {
    const validation = validateSaveReservationPayload(req.body, validGiteIds);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const { giteId, name, start, end, summary, price, phone } = validation.value;
      const sheetName = sheetNames[giteId];
      if (!sheetName) return res.status(400).json({ success: false, error: 'Invalid gite' });

      const token = await getAccessToken();
      const sheetId = await getSheetId(sheetName, token);

      const valueRes = await fetchFn(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!B2:C`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!valueRes.ok) {
        const text = await valueRes.text().catch(() => '');
        throw new Error(`Sheets values error ${valueRes.status}: ${text}`);
      }

      const valueData = await valueRes.json();
      const rows = valueData.values || [];
      const startDate = dayjs(start, 'DD/MM/YYYY');
      const endDate = dayjs(end, 'DD/MM/YYYY');

      async function insertHighlightedRow(rowIndex) {
        await fetchFn(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            requests: [
              {
                insertDimension: {
                  range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
                  inheritFromBefore: false
                }
              },
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: rowIndex - 1,
                    endRowIndex: rowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: 11
                  },
                  cell: { userEnteredFormat: { backgroundColor: { red: 0.8, green: 0.9, blue: 1 } } },
                  fields: 'userEnteredFormat.backgroundColor'
                }
              }
            ]
          })
        });
      }

      const priceValue = typeof price === 'number' ? price : '';
      let phoneValue = '';
      if (typeof phone === 'string' && phone.trim()) {
        phoneValue = phone.trim();
      } else if (typeof summary === 'string') {
        const m = summary.match(/\bT:\s*([0-9 +().-]+)/);
        phoneValue = m ? m[1].trim() : '';
      }

      const chunks = [];
      if (startDate.isValid() && endDate.isValid()) {
        let cur = startDate.startOf('day');
        const endD = endDate.startOf('day');
        while (cur.isBefore(endD, 'day')) {
          const nextMonthStart = cur.add(1, 'month').startOf('month');
          const stop = endD.isBefore(nextMonthStart) ? endD : nextMonthStart;
          if (stop.isAfter(cur, 'day')) {
            chunks.push({ start: cur, end: stop });
          }
          cur = stop;
        }
      } else {
        chunks.push({ start: startDate, end: endDate });
      }

      let insertOffset = 0;
      for (const ch of chunks) {
        let idx = rows.findIndex(r => {
          const rowStart = dayjs(r[0], 'DD/MM/YYYY');
          const rowEnd = dayjs(r[1], 'DD/MM/YYYY');
          return ch.start.isBefore(rowStart) || (ch.start.isSame(rowStart) && ch.end.isBefore(rowEnd));
        });
        if (idx === -1) idx = rows.length;
        const rowNumber = idx + 2 + insertOffset;

        await insertHighlightedRow(rowNumber);

        const startStr = ch.start.format('DD/MM/YYYY');
        const endStr = ch.end.format('DD/MM/YYYY');
        const monthName = ch.start.format('MMMM');
        const nights = Math.max(ch.end.diff(ch.start, 'day'), 0);
        const capacity = giteId === 'liberte' ? 10 : 2;
        const formulaH = `=G${rowNumber}*E${rowNumber}`;
        const statusI = 'A définir';

        await fetchFn(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${rowNumber}:K${rowNumber}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              values: [[
                name,
                startStr,
                endStr,
                monthName,
                nights,
                capacity,
                priceValue,
                formulaH,
                statusI,
                summary.replace(/\n/g, ' '),
                phoneValue
              ]]
            })
          }
        );

        rows.splice(idx, 0, [startStr, endStr]);
        insertOffset += 1;
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
