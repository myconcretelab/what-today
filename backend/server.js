import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import ical from 'node-ical';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import 'dayjs/locale/fr.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createContratsIntegration } from './services/contrats-integration.js';
import { createAdminRouter } from './routes/admin-routes.js';
import { createArrivalsRouter } from './routes/arrivals-routes.js';
import { createCommentsRouter } from './routes/comments-routes.js';
import { createReservationRouter } from './routes/reservation-routes.js';
import { readData } from './store/local-data-store.js';
import { SCHOOL_DATASET_BASE, GITES } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './.env') });

dayjs.extend(customParseFormat);
dayjs.locale('fr');

const contratsIntegration = createContratsIntegration({
  baseUrl: process.env.CONTRATS_API_BASE_URL,
  apiToken: process.env.CONTRATS_API_TOKEN,
  basicPassword: process.env.CONTRATS_API_BASIC_PASSWORD,
  basicUser: process.env.CONTRATS_API_BASIC_USER || 'what-today',
  explicitGiteMap: process.env.CONTRATS_GITE_MAP,
  getExplicitGiteMap: () => {
    const data = readData();
    if (!data || typeof data !== 'object') return {};
    return data.giteMappings || {};
  },
  gites: GITES,
  fetchFn: fetch
});

if (!contratsIntegration.enabled) {
  throw new Error('CONTRATS_API_BASE_URL is required.');
}

console.log('Contrats integration enabled');

const VALID_GITE_IDS = new Set(GITES.map(gite => gite.id));

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api', createAdminRouter({
  listContratsGites: () => contratsIntegration.listContratsGites()
}));

app.use('/api', createArrivalsRouter({
  awaitIcalLoadIfNeeded,
  startIcalLoad,
  getReservations: () => reservations,
  getErrors: () => erreurs
}));

app.use('/api', createCommentsRouter({
  validGiteIds: VALID_GITE_IDS,
  getCommentsRange: (startIso, endIso) => contratsIntegration.fetchCommentsRange(startIso, endIso),
  getSingleComment: (giteId, isoDate) => contratsIntegration.fetchSingleComment(giteId, isoDate)
}));

app.use('/api', createReservationRouter({
  validGiteIds: VALID_GITE_IDS,
  saveReservation: payload => contratsIntegration.saveManualReservation(payload)
}));

const holidaysCache = {};

async function fetchHolidaysForYear(year, opts = {}) {
  const { zones = ['A', 'B', 'C'], population = null } = opts;
  const academicYear = `${year}-${year + 1}`;
  const pageSize = 100;
  let offset = 0;
  const allRows = [];

  try {
    while (true) {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        order_by: 'start_date'
      });
      params.append('refine', `annee_scolaire:${academicYear}`);
      if (population) params.append('refine', `population:${population}`);

      const url = `${SCHOOL_DATASET_BASE}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const chunk = Array.isArray(json.results) ? json.results : [];
      allRows.push(...chunk);

      if (chunk.length < pageSize) break;
      offset += pageSize;
    }

    const holidays = [];
    for (const item of allRows) {
      const rawZones = (item.zones ?? '').toString();
      const normalizedZones = rawZones
        .split(/[/,;]| et /i)
        .map(s => s.trim())
        .filter(Boolean)
        .map(z => z.replace(/Zone\s*/i, '').trim());

      const start = (item.start_date || '').slice(0, 10);
      const end = (item.end_date || '').slice(0, 10);
      const description = item.description || item.vacances || item.intitule || '';
      const recordPopulation = item.population || '';

      const zonesToPush = normalizedZones.length ? normalizedZones : [''];
      for (const zone of zonesToPush) {
        if (zone && zones.length && !zones.includes(zone)) continue;
        holidays.push({
          zone: zone || '-',
          start,
          end,
          description,
          anneeScolaire: item.annee_scolaire || academicYear,
          population: recordPopulation
        });
      }
    }

    holidaysCache[year] = holidays;
    console.log(`Fetched ${holidays.length} holiday items from ${allRows.length} rows for ${academicYear} (${year})`);
    return holidays;
  } catch (err) {
    console.error(`Failed to fetch holidays for ${year} ${err.message}`);
    holidaysCache[year] = [];
    return [];
  }
}

async function initHolidays() {
  const currentYear = dayjs().year();
  const years = [currentYear, currentYear + 1];
  await Promise.all(years.map(fetchHolidaysForYear));
}

initHolidays();

function normalizeToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [val];
}

function summaryMatches(summary, needle) {
  if (!summary || !needle) return false;
  const s = String(summary);
  const n = String(needle);
  return s.includes(n) || s.trim() === n;
}

function shouldKeepBySummary(summary, source) {
  const includes = normalizeToArray(source.includeSummary);
  const excludes = normalizeToArray(source.excludeSummary);

  if (includes.length > 0) {
    const ok = includes.some(needle => summaryMatches(summary, needle));
    if (!ok) return false;
  }
  if (excludes.length > 0) {
    const blocked = excludes.some(needle => summaryMatches(summary, needle));
    if (blocked) return false;
  }
  return true;
}

function isReservedOrBooked(summary) {
  if (!summary) return false;
  const normalized = String(summary).trim().toUpperCase();
  return normalized === 'RESERVED' || normalized === 'BOOKED';
}

function preferReservation(a, b) {
  const aPreferred = isReservedOrBooked(a.resume);
  const bPreferred = isReservedOrBooked(b.resume);
  let winner;

  if (aPreferred && !bPreferred) winner = a;
  else if (!aPreferred && bPreferred) winner = b;
  else {
    const aStart = dayjs(a.debut, 'YYYY-MM-DD');
    const bStart = dayjs(b.debut, 'YYYY-MM-DD');
    if (aStart.isValid() && bStart.isValid()) {
      winner = aStart.isBefore(bStart) ? a : b;
    } else {
      winner = a;
    }
  }

  const merged = { ...winner };
  if (!merged.airbnbUrl && a.airbnbUrl) merged.airbnbUrl = a.airbnbUrl;
  if (!merged.airbnbUrl && b.airbnbUrl) merged.airbnbUrl = b.airbnbUrl;
  return merged;
}

function dedupeReservations(list) {
  const byPeriod = new Map();
  for (const item of list) {
    const key = `${item.giteId}|${item.debut}|${item.fin}`;
    const previous = byPeriod.get(key);
    if (!previous) {
      byPeriod.set(key, item);
      continue;
    }
    byPeriod.set(key, preferReservation(previous, item));
  }

  const winners = Array.from(byPeriod.values());
  const byEnd = new Map();
  for (const item of winners) {
    const key = `${item.giteId}|${item.fin}`;
    const previous = byEnd.get(key);
    if (!previous) {
      byEnd.set(key, item);
      continue;
    }
    byEnd.set(key, preferReservation(previous, item));
  }

  return Array.from(byEnd.values());
}

function extractAirbnbUrl(description) {
  if (!description) return '';
  const text = String(description);
  const direct = text.match(/Reservation URL:\s*(https?:\/\/\S+)/i);
  if (direct && direct[1]) return direct[1].trim();

  const fallback = text.match(/https?:\/\/(?:www\.)?airbnb\.[^\s\n]+/i);
  if (fallback && fallback[0]) return fallback[0].trim();
  return '';
}

function formatIcalDate(value) {
  if (!value) return null;
  const utcHour = value.getUTCHours();
  if (utcHour === 22) {
    return dayjs(value).add(2, 'hour').format('YYYY-MM-DD');
  }
  if (utcHour === 23) {
    return dayjs(value).add(1, 'hour').format('YYYY-MM-DD');
  }
  return dayjs(value).format('YYYY-MM-DD');
}

let reservations = [];
let erreurs = new Set();
let icalLoadPromise = null;

async function chargerCalendriers() {
  console.time('ical-load');
  for (const gite of GITES) {
    for (const source of gite.sources) {
      try {
        const res = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
          }
        });
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter) {
          console.log('Retry-After recu pour', source.url, ':', retryAfter);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const data = ical.parseICS(text);
        for (const ev of Object.values(data)) {
          if (ev.type !== 'VEVENT') continue;
          if (!shouldKeepBySummary(ev.summary, source)) continue;

          const airbnbUrl = source.type === 'Airbnb' ? extractAirbnbUrl(ev.description) : '';
          reservations.push({
            giteId: gite.id,
            giteNom: gite.nom,
            couleur: gite.couleur,
            source: source.type,
            debut: formatIcalDate(ev.start),
            fin: formatIcalDate(ev.end),
            resume: ev.summary || '',
            airbnbUrl: airbnbUrl || ''
          });
        }

        console.log('Chargement reussi pour', gite.nom, 'depuis', source.type);
      } catch (err) {
        erreurs.add(gite.id);
        console.error('Erreur de chargement pour', gite.nom, err.message);
      }
    }
  }

  const today = dayjs().startOf('day');
  const startWindow = today.subtract(5, 'day');
  reservations = reservations.filter(item => {
    const end = dayjs(item.fin);
    return end.isAfter(startWindow);
  });

  reservations = dedupeReservations(reservations);
  console.timeEnd('ical-load');
}

function startIcalLoad({ reset = false } = {}) {
  if (reset) {
    reservations = [];
    erreurs = new Set();
  }

  if (!icalLoadPromise) {
    const loadPromise = (async () => {
      await chargerCalendriers();
    })();

    icalLoadPromise = loadPromise;
    loadPromise.catch(err => {
      console.error('Erreur pendant le chargement iCal:', err.message);
    });
    loadPromise.finally(() => {
      if (icalLoadPromise === loadPromise) {
        icalLoadPromise = null;
      }
    });
  }

  return icalLoadPromise;
}

async function awaitIcalLoadIfNeeded() {
  if (!icalLoadPromise) return;
  try {
    await icalLoadPromise;
  } catch {
    // Error already logged in startIcalLoad.
  }
}

startIcalLoad({ reset: true });

app.get('/api/debug-duplicates', (req, res) => {
  const { giteId } = req.query;
  let { day } = req.query;
  if (!day) {
    day = dayjs().add(1, 'day').format('YYYY-MM-DD');
  }

  let subset = Array.isArray(reservations) ? reservations.slice() : [];
  if (giteId) subset = subset.filter(item => item.giteId === giteId);

  subset = subset.filter(item => {
    const start = dayjs(item.debut, 'YYYY-MM-DD');
    const end = dayjs(item.fin, 'YYYY-MM-DD');
    const target = dayjs(day, 'YYYY-MM-DD');
    return target.isSame(start, 'day') || (target.isAfter(start, 'day') && target.isBefore(end, 'day'));
  });

  const groups = {};
  for (const item of subset) {
    const key = `${item.giteId}|${item.debut}|${item.fin}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const duplicateGroups = Object.entries(groups)
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      items: items.map(x => ({ source: x.source, resume: x.resume, debut: x.debut, fin: x.fin }))
    }));

  const groupsByEnd = {};
  for (const item of subset) {
    const key = `${item.giteId}|${item.fin}`;
    if (!groupsByEnd[key]) groupsByEnd[key] = [];
    groupsByEnd[key].push(item);
  }

  const duplicateEndGroups = Object.entries(groupsByEnd)
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      items: items.map(x => ({ source: x.source, resume: x.resume, debut: x.debut, fin: x.fin }))
    }));

  const after = dedupeReservations(subset);

  res.json({
    giteId: giteId || null,
    day,
    beforeCount: subset.length,
    afterCount: after.length,
    duplicateGroups,
    duplicateEndGroups,
    after
  });
});

app.get('/api/school-holidays', (req, res) => {
  const year = parseInt(req.query.year, 10) || dayjs().year();
  const zone = req.query.zone ? req.query.zone.toUpperCase() : 'B';
  const data = holidaysCache[year] || [];
  const filtered = zone ? data.filter(item => item.zone === zone) : data;
  res.json(filtered);
});

const buildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(buildPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Serveur demarre sur le port', PORT);
});
