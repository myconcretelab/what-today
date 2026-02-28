import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import { createArrivalsRouter } from '../routes/arrivals-routes.js';
import { invokeRoute } from './helpers/router-request.js';

test('GET /api/arrivals returns reservations, errors and computed dates', async () => {
  const reservations = [
    { giteId: 'gree', debut: '2026-03-01', fin: '2026-03-04', source: 'Airbnb' },
    { giteId: 'phonsine', debut: '2026-03-02', fin: '2026-03-08', source: 'Abritel' }
  ];
  const errors = new Set(['edmond']);

  const router = createArrivalsRouter({
    awaitIcalLoadIfNeeded: async () => {},
    startIcalLoad: async () => {},
    getReservations: () => reservations,
    getErrors: () => errors
  });

  const res = await invokeRoute(router, { method: 'GET', path: '/arrivals' });
  assert.equal(res.status, 200);
  const body = res.body;

  assert.equal(Array.isArray(body.reservations), true);
  assert.equal(body.reservations.length, 2);
  assert.deepEqual(body.erreurs, ['edmond']);
  assert.equal(Array.isArray(body.dates), true);
  assert.equal(body.dates.length > 0, true);

  const expectedFirstDate = dayjs().startOf('day').subtract(5, 'day').format('YYYY-MM-DD');
  assert.equal(body.dates[0], expectedFirstDate);
  assert.equal(body.dates.includes('2026-03-08'), true);
});

test('POST /api/reload-icals returns success', async () => {
  let called = false;
  const router = createArrivalsRouter({
    awaitIcalLoadIfNeeded: async () => {},
    startIcalLoad: async () => {
      called = true;
    },
    getReservations: () => [],
    getErrors: () => new Set()
  });

  const res = await invokeRoute(router, { method: 'POST', path: '/reload-icals' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true });
  assert.equal(called, true);
});
