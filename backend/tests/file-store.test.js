import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { writeJsonFileQueued } from '../file-store.js';

test('writeJsonFileQueued writes JSON atomically', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wt-file-store-'));
  const filePath = path.join(tempDir, 'data.json');

  await writeJsonFileQueued(filePath, { value: 1 });

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, { value: 1 });

  await fs.rm(tempDir, { recursive: true, force: true });
});

test('writeJsonFileQueued serializes successive writes', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wt-file-store-'));
  const filePath = path.join(tempDir, 'data.json');

  const first = writeJsonFileQueued(filePath, { order: 1 });
  const second = writeJsonFileQueued(filePath, { order: 2 });
  await Promise.all([first, second]);

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, { order: 2 });

  await fs.rm(tempDir, { recursive: true, force: true });
});
