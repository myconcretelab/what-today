import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportRouter } from '../routes/import-routes.js';
import { invokeRoute } from './helpers/router-request.js';

function createImportRouterForTest({ importReservationsToSheets }) {
  return createImportRouter({
    backendDir: process.cwd(),
    parseHarReservationsByListing: () => ({}),
    writeTextFileQueued: async () => {},
    resolveGiteId: () => null,
    sheetNames: {},
    splitReservationByMonth: reservation => [reservation],
    buildPreviewResponse: async () => ({ reservations: [], counts: {}, byGite: {} }),
    awaitIcalLoadIfNeeded: async () => {},
    startIcalLoad: async () => {},
    buildIcalFlatReservations: () => [],
    importReservationsToSheets,
    buildImportLogEntry: ({ source, selectionCount, summary }) => ({
      source,
      selectionCount,
      summary
    }),
    recordImportLog: async () => {}
  });
}

test('POST /api/har/import imports validated reservations', async () => {
  let receivedReservations = null;
  const router = createImportRouterForTest({
    importReservationsToSheets: async reservations => {
      receivedReservations = reservations;
      return {
        inserted: reservations.length,
        updated: 0,
        skipped: { duplicate: 0, invalid: 0, outsideYear: 0, unknown: 0 },
        perGite: {},
        insertedItems: []
      };
    }
  });

  const payload = {
    reservations: [
      {
        giteId: 'gree',
        type: 'airbnb',
        checkIn: '2026-04-10',
        checkOut: '2026-04-13',
        nights: 3,
        name: 'John Doe',
        payout: 450,
        comment: 'Late arrival',
        source: 'Airbnb'
      }
    ]
  };

  const res = await invokeRoute(router, {
    method: 'POST',
    path: '/har/import',
    body: payload
  });
  assert.equal(res.status, 200);
  const responseBody = res.body;
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.inserted, 1);
  assert.equal(Array.isArray(receivedReservations), true);
  assert.equal(receivedReservations.length, 1);
  assert.equal(receivedReservations[0].checkIn, '2026-04-10');
  assert.equal(receivedReservations[0].checkOut, '2026-04-13');
});

test('POST /api/har/import returns 400 for invalid payload', async () => {
  const router = createImportRouterForTest({
    importReservationsToSheets: async () => {
      throw new Error('should not be called');
    }
  });

  const res = await invokeRoute(router, {
    method: 'POST',
    path: '/har/import',
    body: { reservations: [{ checkIn: 'bad-date', checkOut: '2026-04-13' }] }
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Invalid reservation dates/);
});
