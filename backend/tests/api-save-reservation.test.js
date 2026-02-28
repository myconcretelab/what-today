import test from 'node:test';
import assert from 'node:assert/strict';
import { createReservationRouter } from '../routes/reservation-routes.js';
import { invokeRoute } from './helpers/router-request.js';

function makeResponse({ ok = true, status = 200, jsonData = {}, textData = '' } = {}) {
  return {
    ok,
    status,
    async json() {
      return jsonData;
    },
    async text() {
      return textData;
    }
  };
}

test('POST /api/save-reservation saves a reservation through Sheets API calls', async () => {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, options });

    if (url.includes('/values/Phonsine!B2:C')) {
      return makeResponse({
        ok: true,
        jsonData: { values: [['01/03/2026', '03/03/2026']] }
      });
    }

    if (url.includes(':batchUpdate')) {
      return makeResponse({ ok: true, jsonData: {} });
    }

    if (url.includes('/values/Phonsine!A')) {
      return makeResponse({ ok: true, jsonData: {} });
    }

    return makeResponse({ ok: true, jsonData: {} });
  };

  const router = createReservationRouter({
    sheetNames: { phonsine: 'Phonsine' },
    spreadsheetId: 'spreadsheet-id',
    getAccessToken: async () => 'token',
    getSheetId: async () => 123,
    fetchFn
  });

  const payload = {
    giteId: 'phonsine',
    name: 'Jane Doe',
    start: '14/03/2026',
    end: '16/03/2026',
    summary: 'Summary line',
    price: 120,
    phone: '06 12 34 56 78'
  };

  const res = await invokeRoute(router, {
    method: 'POST',
    path: '/save-reservation',
    body: payload
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true });

  assert.equal(calls.some(call => call.url.includes(':batchUpdate')), true);
  assert.equal(calls.some(call => call.url.includes('/values/Phonsine!A')), true);
});

test('POST /api/save-reservation returns 400 for invalid dates', async () => {
  const router = createReservationRouter({
    sheetNames: { phonsine: 'Phonsine' },
    spreadsheetId: 'spreadsheet-id',
    getAccessToken: async () => 'token',
    getSheetId: async () => 123,
    fetchFn: async () => makeResponse({ ok: true, jsonData: {} })
  });

  const res = await invokeRoute(router, {
    method: 'POST',
    path: '/save-reservation',
    body: {
      giteId: 'phonsine',
      name: 'Jane Doe',
      start: '16/03/2026',
      end: '14/03/2026',
      summary: 'Summary line'
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});
