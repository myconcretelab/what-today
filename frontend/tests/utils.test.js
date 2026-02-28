import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceColor,
  eventColor,
  giteInitial,
  borderWidth,
  borderColor,
  statusBorderColor
} from '../src/utils.js';

test('sourceColor returns mapped and fallback colors', () => {
  assert.equal(sourceColor('Airbnb'), '#E53935');
  assert.equal(sourceColor('Unknown source'), '#9E9E9E');
});

test('eventColor returns mapped and fallback colors', () => {
  assert.equal(eventColor('arrival'), '#f7e1d7');
  assert.equal(eventColor('unexpected'), '#edafb8');
});

test('giteInitial returns expected initials and fallback', () => {
  assert.equal(giteInitial('phonsine'), 'P');
  assert.equal(giteInitial('edmond'), 'E');
  assert.equal(giteInitial('unknown'), '?');
});

test('border helpers return expected values', () => {
  assert.equal(borderWidth('arrival'), 3);
  assert.equal(borderWidth('missing'), 3);
  assert.equal(borderColor('depart'), '#dedbd2');
  assert.equal(borderColor('missing'), '#edafb8');
});

test('statusBorderColor toggles done and pending colors', () => {
  assert.equal(statusBorderColor(true), '#4a5759');
  assert.equal(statusBorderColor(false), '#dedbd2');
});
