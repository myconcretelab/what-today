import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDateRangeQuery,
  validateStatusUpdatePayload,
  validateSaveReservationPayload,
  validateHarImportPayload,
  validateDataPayload
} from '../validation.js';

test('validateDateRangeQuery accepts valid range', () => {
  const result = validateDateRangeQuery('2026-02-01', '2026-02-15');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { start: '2026-02-01', end: '2026-02-15' });
});

test('validateDateRangeQuery rejects reversed range', () => {
  const result = validateDateRangeQuery('2026-02-15', '2026-02-01');
  assert.equal(result.ok, false);
  assert.match(result.error, /End date/);
});

test('validateStatusUpdatePayload validates status body', () => {
  const valid = validateStatusUpdatePayload({ done: true, user: 'Soaz' });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { done: true, user: 'Soaz' });

  const invalid = validateStatusUpdatePayload({ done: 'yes' });
  assert.equal(invalid.ok, false);
});

test('validateSaveReservationPayload accepts valid reservation body', () => {
  const validGiteIds = new Set(['phonsine', 'gree', 'edmond', 'liberte']);
  const result = validateSaveReservationPayload({
    giteId: 'gree',
    name: 'Jane Doe',
    start: '14/03/2026',
    end: '17/03/2026',
    summary: 'Test reservation',
    phone: '06 12 34 56 78',
    price: 120
  }, validGiteIds);

  assert.equal(result.ok, true);
  assert.equal(result.value.giteId, 'gree');
  assert.equal(result.value.start, '14/03/2026');
  assert.equal(result.value.end, '17/03/2026');
});

test('validateHarImportPayload validates and sanitizes reservations', () => {
  const result = validateHarImportPayload({
    reservations: [
      {
        existingReservationId: 'res_123',
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
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reservations.length, 1);
  assert.equal(result.value.reservations[0].type, 'airbnb');
  assert.equal(result.value.reservations[0].existingReservationId, 'res_123');

  const invalid = validateHarImportPayload({
    reservations: [{ checkIn: 'bad-date', checkOut: '2026-04-13' }]
  });
  assert.equal(invalid.ok, false);
});

test('validateDataPayload accepts giteMappings', () => {
  const validGiteIds = new Set(['phonsine', 'gree', 'edmond', 'liberte']);
  const result = validateDataPayload({
    prices: [],
    texts: [],
    themes: [],
    activeThemeId: 'default',
    giteMappings: {
      phonsine: 'cuid_phonsine',
      gree: ''
    }
  }, validGiteIds);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.giteMappings, {
    phonsine: 'cuid_phonsine',
    gree: ''
  });
});
