import fs from 'fs';
import {
  STATUS_FILE,
  DATA_FILE,
  COMMENTS_FILE,
  IMPORT_LOG_FILE,
  IMPORT_LOG_LIMIT
} from '../config.js';
import { writeJsonFileQueued } from '../file-store.js';

const DEFAULT_DATA = {
  prices: [],
  texts: [],
  themes: [],
  activeThemeId: 'default'
};

export function readStatuses() {
  if (!fs.existsSync(STATUS_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
}

export async function writeStatuses(data) {
  await writeJsonFileQueued(STATUS_FILE, data);
}

export function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ...DEFAULT_DATA };
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!raw || !raw.trim()) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_DATA };
    if (!Array.isArray(parsed.prices)) parsed.prices = [];
    if (!Array.isArray(parsed.texts)) parsed.texts = [];
    if (!Array.isArray(parsed.themes)) parsed.themes = [];
    if (!parsed.activeThemeId) parsed.activeThemeId = 'default';
    return parsed;
  } catch (e) {
    console.error('Failed to read data.json:', e.message);
    return { ...DEFAULT_DATA };
  }
}

export async function writeData(data) {
  await writeJsonFileQueued(DATA_FILE, data);
}

export function readPrices() {
  return readData().prices || [];
}

export async function writePrices(prices) {
  const data = readData();
  data.prices = prices;
  await writeData(data);
}

export function readTexts() {
  return readData().texts || [];
}

export async function writeTexts(texts) {
  const data = readData();
  data.texts = texts;
  await writeData(data);
}

export function readCommentsCache() {
  try {
    if (!fs.existsSync(COMMENTS_FILE)) return {};
    const raw = fs.readFileSync(COMMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.error('Failed to read comments cache:', e.message);
    return {};
  }
}

export async function writeCommentsCache(cache) {
  try {
    await writeJsonFileQueued(COMMENTS_FILE, cache);
  } catch (e) {
    console.error('Failed to write comments cache:', e.message);
  }
}

export function readImportLog() {
  try {
    if (!fs.existsSync(IMPORT_LOG_FILE)) return [];
    const raw = fs.readFileSync(IMPORT_LOG_FILE, 'utf-8');
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read import log:', e.message);
    return [];
  }
}

export async function writeImportLog(entries) {
  await writeJsonFileQueued(IMPORT_LOG_FILE, entries);
}

export async function appendImportLog(entry) {
  const log = readImportLog();
  log.unshift(entry);
  const trimmed = log.slice(0, IMPORT_LOG_LIMIT);
  await writeImportLog(trimmed);
  return trimmed;
}
