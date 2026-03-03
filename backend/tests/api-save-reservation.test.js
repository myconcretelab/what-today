import test from 'node:test';
import assert from 'node:assert/strict';
import { createReservationRouter } from '../routes/reservation-routes.js';
import { invokeRoute } from './helpers/router-request.js';

test('POST /api/save-reservation saves a reservation through contrats handler', async () => {
  let receivedPayload = null;
  const router = createReservationRouter({
    validGiteIds: new Set(['phonsine']),
    saveReservation: async payload => {
      receivedPayload = payload;
    }
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
  assert.deepEqual(receivedPayload, payload);
});

test('POST /api/save-reservation returns 400 for invalid dates', async () => {
  const router = createReservationRouter({
    validGiteIds: new Set(['phonsine']),
    saveReservation: async () => {}
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

test('POST /api/save-reservation returns 500 when save handler is missing', async () => {
  const router = createReservationRouter({
    validGiteIds: new Set(['phonsine'])
  });

  const res = await invokeRoute(router, {
    method: 'POST',
    path: '/save-reservation',
    body: {
      giteId: 'phonsine',
      name: 'Jane Doe',
      start: '14/03/2026',
      end: '16/03/2026',
      summary: 'Summary line'
    }
  });

  assert.equal(res.status, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: 'Reservation persistence is not configured'
  });
});
