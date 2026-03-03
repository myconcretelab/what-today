import fs from 'fs';
import {
  STATUS_FILE,
  DATA_FILE
} from '../config.js';
import { writeJsonFileQueued } from '../file-store.js';

const DEFAULT_DATA = {
  prices: [],
  texts: [],
  themes: [],
  activeThemeId: 'default',
  giteMappings: {}
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
    if (!parsed.giteMappings || typeof parsed.giteMappings !== 'object' || Array.isArray(parsed.giteMappings)) {
      parsed.giteMappings = {};
    }
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
