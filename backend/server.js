import dotenv from 'dotenv'; // Change from require('dotenv')
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import ical from 'node-ical';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js'; // <-- Add this line
import 'dayjs/locale/fr.js';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createSheetsClient } from './services/sheets-client.js';
import { createContratsIntegration } from './services/contrats-integration.js';
import { createAdminRouter } from './routes/admin-routes.js';
import { createArrivalsRouter } from './routes/arrivals-routes.js';
import { createCommentsRouter } from './routes/comments-routes.js';
import { createReservationRouter } from './routes/reservation-routes.js';
import {
  readCommentsCache,
  writeCommentsCache,
  readData
} from './store/local-data-store.js';
import {
  SHEET_NAMES,
  RUN_COL_INDEX,
  HAR_HIGHLIGHT_COLOR,
  WRITE_THROTTLE_MS,
  WRITE_RETRY_LIMIT,
  WRITE_BACKOFF_BASE_MS,
  WRITE_BACKOFF_MAX_MS,
  SCHOOL_DATASET_BASE,
  GITES
} from './config.js';


// Pour avoir __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './.env') }); // <-- Changed line

// Configuration locale française pour dayjs
// permet d'avoir des dates formatées "lundi 31/12/2025"
dayjs.extend(customParseFormat);
dayjs.locale('fr');

const spreadsheetId = process.env.SPREAD_SHEET_ID;
const sheetsClient = createSheetsClient({
  spreadsheetId,
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  fetchFn: fetch,
  writeThrottleMs: WRITE_THROTTLE_MS,
  writeRetryLimit: WRITE_RETRY_LIMIT,
  writeBackoffBaseMs: WRITE_BACKOFF_BASE_MS,
  writeBackoffMaxMs: WRITE_BACKOFF_MAX_MS
});
const {
  requestWrite,
  getAccessToken,
  getSheetId,
  fetchSheetValues
} = sheetsClient;

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

if (contratsIntegration.enabled) {
  console.log('Contrats integration enabled');
}

const saveReservationFromPanel = contratsIntegration.enabled
  ? async payload => contratsIntegration.saveManualReservation(payload)
  : null;

const app = express();
app.use(cors());
// Increase JSON body limit to allow large HAR uploads
app.use(express.json({ limit: '50mb' }));
app.use('/api', createAdminRouter({
  listContratsGites: contratsIntegration.enabled
    ? () => contratsIntegration.listContratsGites()
    : null
}));
app.use('/api', createArrivalsRouter({
  awaitIcalLoadIfNeeded,
  startIcalLoad,
  getReservations: () => reservations,
  getErrors: () => erreurs
}));
app.use('/api', createCommentsRouter({
  sheetNames: SHEET_NAMES,
  readCommentsCache,
  commentsKey,
  refreshCommentsForAllGitesInRange,
  refreshSingleComment,
  getCommentsRange: contratsIntegration.enabled
    ? (startIso, endIso) => contratsIntegration.fetchCommentsRange(startIso, endIso)
    : null,
  getSingleComment: contratsIntegration.enabled
    ? (giteId, isoDate) => contratsIntegration.fetchSingleComment(giteId, isoDate)
    : null
}));
app.use('/api', createReservationRouter({
  sheetNames: SHEET_NAMES,
  spreadsheetId,
  getAccessToken,
  getSheetId,
  fetchFn: fetch,
  saveReservation: saveReservationFromPanel
}));

function normalizeHeaderName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
}

function getColumnIndex(header, name) {
  const target = normalizeHeaderName(name);
  for (let i = 0; i < header.length; i++) {
    if (normalizeHeaderName(header[i]) === target) return i;
  }
  return -1;
}

function normalizeGiteName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
}

const GITE_ID_BY_SHEET = Object.fromEntries(
  Object.entries(SHEET_NAMES).map(([id, name]) => [normalizeGiteName(name), id])
);
const GITE_NAME_BY_ID = Object.fromEntries(
  GITES.map(gite => [gite.id, gite.nom])
);

function resolveGiteId(listingName) {
  const key = normalizeGiteName(listingName);
  return GITE_ID_BY_SHEET[key] || null;
}

function resolveGiteName(giteId, fallbackName) {
  if (typeof fallbackName === 'string' && fallbackName.trim()) return fallbackName;
  if (giteId && GITE_NAME_BY_ID[giteId]) return GITE_NAME_BY_ID[giteId];
  if (giteId && SHEET_NAMES[giteId]) return SHEET_NAMES[giteId];
  return '';
}

function formatDateFr(isoDate) {
  const d = dayjs(isoDate, 'YYYY-MM-DD');
  return d.isValid() ? d.format('DD/MM/YYYY') : '';
}

function parseSheetDateToIso(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const parsed = dayjs(trimmed, ['DD/MM/YYYY', 'YYYY-MM-DD', 'YYYYMMDD'], true);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
    const fallback = dayjs(trimmed);
    return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null;
  }
  return null;
}

function isEmptyCell(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function overlapsCurrentYear(startIso, endIso) {
  if (!startIso || !endIso) return false;
  const start = dayjs(startIso, 'YYYY-MM-DD');
  const endExclusive = dayjs(endIso, 'YYYY-MM-DD');
  if (!start.isValid() || !endExclusive.isValid()) return false;
  const year = dayjs().year();
  const yearStart = dayjs(`${year}-01-01`, 'YYYY-MM-DD');
  const yearEnd = dayjs(`${year}-12-31`, 'YYYY-MM-DD');
  const endInclusive = endExclusive.subtract(1, 'day');
  return !start.isAfter(yearEnd, 'day') && !endInclusive.isBefore(yearStart, 'day');
}

function toColumnLetter(index) {
  let col = '';
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col || 'A';
}

function parseRowNumberFromRange(range) {
  if (!range) return null;
  const match = range.match(/!([A-Z]+)(\d+):/);
  if (match) return parseInt(match[2], 10);
  const fallback = range.match(/!([A-Z]+)(\d+)/);
  return fallback ? parseInt(fallback[2], 10) : null;
}

function buildSheetColumns(header) {
  const iNom = getColumnIndex(header, 'Nom');
  const iDebut = getColumnIndex(header, 'Debut');
  const iFin = getColumnIndex(header, 'Fin');
  const iNuits = getColumnIndex(header, 'Nb Nuits');
  const iAdultes = getColumnIndex(header, 'Nb Adultes');
  let iPrixNuit = getColumnIndex(header, 'Prix/nuits');
  if (iPrixNuit === -1) iPrixNuit = getColumnIndex(header, 'Prix/nuit');
  const iRevenus = getColumnIndex(header, 'Revenus');
  const iPaiement = getColumnIndex(header, 'Paiement');
  let iComment = getColumnIndex(header, 'Comment');
  if (iComment === -1) iComment = getColumnIndex(header, 'Commentaire');

  const colDebut = iDebut !== -1 ? iDebut + 1 : 2;
  const colFin = iFin !== -1 ? iFin + 1 : 3;
  const colNuits = iNuits !== -1 ? iNuits + 1 : 4;
  const colAdultes = iAdultes !== -1 ? iAdultes + 1 : 5;
  const colPrixNuit = iPrixNuit !== -1 ? iPrixNuit + 1 : 6;
  const colRevenus = iRevenus !== -1 ? iRevenus + 1 : 7;
  const colPaiement = iPaiement !== -1 ? iPaiement + 1 : 8;
  const colComment = iComment !== -1 ? iComment + 1 : null;
  const colNom = iNom !== -1 ? iNom + 1 : 1;

  const highlightCols = Math.max(
    colPaiement,
    colRevenus,
    colPrixNuit,
    colAdultes,
    colNuits,
    colComment || 0
  );

  return {
    header,
    iDebut,
    iFin,
    colDebut,
    colFin,
    colNuits,
    colAdultes,
    colPrixNuit,
    colRevenus,
    colPaiement,
    colComment,
    colNom,
    highlightCols
  };
}

function getSheetRowLength(columns) {
  return Math.max(columns.header.length, columns.highlightCols, RUN_COL_INDEX);
}

async function fetchSheetHeaderAndRows(sheetName, token) {
  const values = await fetchSheetValues(`${sheetName}!A1:O`, token);
  const header = values[0] || [];
  const rows = values.slice(1);
  return { header, rows };
}

function buildExistingReservationKeySet(rows, columns, giteId) {
  const keys = new Set();
  if (!rows || !Array.isArray(rows)) return keys;
  if (columns.iDebut === -1 || columns.iFin === -1) return keys;
  for (const row of rows) {
    const startIso = parseSheetDateToIso(row[columns.iDebut]);
    const endIso = parseSheetDateToIso(row[columns.iFin]);
    if (startIso && endIso) {
      keys.add(`${giteId}|${startIso}|${endIso}`);
    }
  }
  return keys;
}

function buildExistingReservationIndex(rows, columns, giteId) {
  const index = new Map();
  if (!rows || !Array.isArray(rows)) return index;
  if (columns.iDebut === -1 || columns.iFin === -1) return index;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const startIso = parseSheetDateToIso(row[columns.iDebut]);
    const endIso = parseSheetDateToIso(row[columns.iFin]);
    if (startIso && endIso) {
      index.set(`${giteId}|${startIso}|${endIso}`, {
        row,
        rowNumber: i + 2
      });
    }
  }
  return index;
}

async function updateSingleCell(sheetName, colIndex, rowNumber, value, token) {
  const colLetter = toColumnLetter(colIndex);
  const range = `${sheetName}!${colLetter}${rowNumber}`;
  await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ values: [[value]] })
    },
    { expectJson: true }
  );
}

async function appendRowValues(sheetName, rowValues, token) {
  const lastCol = toColumnLetter(rowValues.length);
  const range = `${sheetName}!A1:${lastCol}`;
  const data = await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ values: [rowValues] })
    },
    { expectJson: true }
  );
  const rowNumber = parseRowNumberFromRange(data?.updates?.updatedRange);
  return rowNumber;
}

async function appendRowsValues(sheetName, rowsValues, token) {
  if (!rowsValues.length) return null;
  const maxLen = rowsValues.reduce((max, row) => Math.max(max, row.length), 0);
  const lastCol = toColumnLetter(maxLen);
  const range = `${sheetName}!A1:${lastCol}`;
  const data = await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ values: rowsValues })
    },
    { expectJson: true }
  );
  const startRow = parseRowNumberFromRange(data?.updates?.updatedRange);
  return { startRow, rowCount: rowsValues.length };
}

async function batchUpdateValues(data, token) {
  if (!data.length) return;
  await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data })
    },
    { expectJson: true }
  );
}

async function highlightRange(sheetId, startRow, rowCount, highlightCols, token) {
  if (rowCount <= 0 || highlightCols <= 0) return;
  await batchUpdateSheets(
    [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRow - 1,
            endRowIndex: startRow - 1 + rowCount,
            startColumnIndex: 0,
            endColumnIndex: highlightCols
          },
          cell: { userEnteredFormat: { backgroundColor: HAR_HIGHLIGHT_COLOR } },
          fields: 'userEnteredFormat.backgroundColor'
        }
      }
    ],
    token
  );
}

async function highlightRow(sheetId, rowNumber, highlightCols, token) {
  await highlightRange(sheetId, rowNumber, 1, highlightCols, token);
}

function normalizeSourceLabel(rawSource) {
  const sourceLabel = typeof rawSource === 'string' ? rawSource.trim() : '';
  if (!sourceLabel) return '';
  const normalized = sourceLabel.toLowerCase();
  if (normalized === 'direct' || normalized === 'perso' || normalized === 'personal') {
    return '';
  }
  return sourceLabel;
}

function resolvePaymentText(reservation) {
  const sourceLabel = normalizeSourceLabel(reservation?.source);
  if (sourceLabel) {
    return sourceLabel;
  }
  return reservation?.type === 'airbnb' ? 'Airbnb' : 'A définir';
}

function buildHarRowValues(reservation, columns, runId) {
  const rowLength = getSheetRowLength(columns);
  const rowValues = Array(rowLength).fill('');
  const startStr = formatDateFr(reservation.checkIn);
  const endStr = formatDateFr(reservation.checkOut);
  const paymentText = resolvePaymentText(reservation);
  const nameValue = reservation.name || '';
  const commentValue = reservation.comment || '';
  const payoutValue = typeof reservation.payout === 'number' ? reservation.payout : '';

  rowValues[columns.colNom - 1] = nameValue;
  rowValues[columns.colDebut - 1] = startStr;
  rowValues[columns.colFin - 1] = endStr;
  rowValues[columns.colPaiement - 1] = paymentText;
  if (columns.colComment) rowValues[columns.colComment - 1] = commentValue;
  if (reservation.type === 'airbnb' && payoutValue !== '') {
    rowValues[columns.colRevenus - 1] = payoutValue;
  }
  if (runId && rowLength >= RUN_COL_INDEX) {
    rowValues[RUN_COL_INDEX - 1] = runId;
  }

  return { rowValues, payoutValue };
}

function resolveNights(reservation) {
  if (typeof reservation.nights === 'number' && Number.isFinite(reservation.nights)) {
    return Math.max(reservation.nights, 0);
  }
  const startDate = dayjs(reservation.checkIn, 'YYYY-MM-DD', true);
  const endDate = dayjs(reservation.checkOut, 'YYYY-MM-DD', true);
  if (!startDate.isValid() || !endDate.isValid()) return 0;
  return Math.max(endDate.diff(startDate, 'day'), 0);
}

function splitReservationByMonth(reservation) {
  const start = dayjs(reservation.checkIn, 'YYYY-MM-DD', true);
  const end = dayjs(reservation.checkOut, 'YYYY-MM-DD', true);
  if (!start.isValid() || !end.isValid() || !end.isAfter(start, 'day')) {
    return [reservation];
  }
  const endInclusive = end.subtract(1, 'day');
  if (start.format('YYYY-MM') === endInclusive.format('YYYY-MM')) {
    return [reservation];
  }

  const totalNights = Math.max(end.diff(start, 'day'), 0);
  const payoutValue = typeof reservation.payout === 'number' ? reservation.payout : null;
  const perNight = payoutValue != null && totalNights > 0 ? payoutValue / totalNights : null;

  const segments = [];
  let cursor = start.startOf('day');
  const endExclusive = end.startOf('day');

  while (cursor.isBefore(endExclusive, 'day')) {
    const nextMonthStart = cursor.add(1, 'month').startOf('month');
    const stop = endExclusive.isBefore(nextMonthStart, 'day') ? endExclusive : nextMonthStart;
    const nights = Math.max(stop.diff(cursor, 'day'), 0);
    if (nights <= 0) break;

    const segment = {
      ...reservation,
      checkIn: cursor.format('YYYY-MM-DD'),
      checkOut: stop.format('YYYY-MM-DD'),
      nights
    };
    if (perNight != null) {
      segment.payout = perNight * nights;
    }
    segments.push(segment);
    cursor = stop;
  }

  return segments.length ? segments : [reservation];
}

function findShiftedAirbnbExistingMatch(existingIndex, columns, reservation) {
  if (!existingIndex || !columns || !reservation) return null;
  if (reservation.type !== 'airbnb') return null;
  if (columns.iDebut === -1 || columns.iFin === -1) return null;

  const sourceLabel = normalizeSourceLabel(reservation.source);
  if (sourceLabel && sourceLabel.toLowerCase() !== 'airbnb') return null;

  const incomingStart = dayjs(reservation.checkIn, 'YYYY-MM-DD', true);
  if (!incomingStart.isValid()) return null;

  // Airbnb iCal peut glisser la date d'arrivée pour un séjour en cours.
  // On limite cette tolérance aux arrivées non futures pour éviter les faux positifs.
  if (incomingStart.isAfter(dayjs().startOf('day'), 'day')) return null;

  for (const [key, existingEntry] of existingIndex.entries()) {
    const row = existingEntry?.row || [];
    const existingStartIso = parseSheetDateToIso(row[columns.iDebut]);
    const existingEndIso = parseSheetDateToIso(row[columns.iFin]);
    if (!existingStartIso || !existingEndIso) continue;
    if (existingEndIso !== reservation.checkOut) continue;

    const existingStart = dayjs(existingStartIso, 'YYYY-MM-DD', true);
    if (!existingStart.isValid()) continue;
    if (!existingStart.isBefore(incomingStart, 'day')) continue;

    const paymentValue = columns.colPaiement ? row[columns.colPaiement - 1] : '';
    const paymentLabel = normalizeSourceLabel(paymentValue);
    if (paymentLabel.toLowerCase() !== 'airbnb') continue;

    return { key, entry: existingEntry, shifted: true };
  }

  return null;
}

function resolveExistingReservationMatch(existingIndex, columns, giteId, reservation) {
  if (!existingIndex || !columns || !giteId || !reservation) return null;
  const key = `${giteId}|${reservation.checkIn}|${reservation.checkOut}`;
  const exactEntry = existingIndex.get(key);
  if (exactEntry) {
    return { key, entry: exactEntry, shifted: false };
  }
  return findShiftedAirbnbExistingMatch(existingIndex, columns, reservation);
}

async function buildPreviewResponse(flatReservations) {
  const token = await getAccessToken();
  const giteIds = Array.from(
    new Set(flatReservations.map(r => r.giteId).filter(Boolean))
  );
  const existingByGite = {};
  for (const giteId of giteIds) {
    const sheetName = SHEET_NAMES[giteId];
    const { header, rows } = await fetchSheetHeaderAndRows(sheetName, token);
    const columns = buildSheetColumns(header);
    const index = buildExistingReservationIndex(rows, columns, giteId);
    existingByGite[giteId] = { columns, index };
  }

  const counts = {
    total: flatReservations.length,
    new: 0,
    existing: 0,
    priceMissing: 0,
    commentMissing: 0,
    nameMissing: 0,
    priceCommentMissing: 0,
    outsideYear: 0,
    invalid: 0,
    unknown: 0
  };
  const byGite = {};
  const reservationsPreview = flatReservations.map((r, idx) => {
    const start = dayjs(r.checkIn, 'YYYY-MM-DD', true);
    const end = dayjs(r.checkOut, 'YYYY-MM-DD', true);
    let status = 'new';
    let reason = '';
    let priceMissing = false;
    let commentMissing = false;
    let nameMissing = false;
    const commentValue = typeof r.comment === 'string' ? r.comment.trim() : '';
    const hasComment = commentValue !== '';
    const nameValue = typeof r.name === 'string' ? r.name.trim() : '';
    const hasName = nameValue !== '';

    if (!r.giteId) {
      status = 'unknown';
      reason = 'gite inconnu';
      counts.unknown += 1;
    } else if (!start.isValid() || !end.isValid()) {
      status = 'invalid';
      reason = 'dates invalides';
      counts.invalid += 1;
    } else if (!overlapsCurrentYear(r.checkIn, r.checkOut)) {
      status = 'outside_year';
      reason = 'hors année';
      counts.outsideYear += 1;
    } else {
      const columns = existingByGite[r.giteId]?.columns;
      const index = existingByGite[r.giteId]?.index;
      const existingMatch = resolveExistingReservationMatch(index, columns, r.giteId, r);
      const existingEntry = existingMatch?.entry || null;

      if (existingEntry && columns) {
        if (r.type === 'airbnb' && typeof r.payout === 'number') {
          priceMissing = isEmptyCell(existingEntry.row[columns.colPrixNuit - 1])
            || isEmptyCell(existingEntry.row[columns.colRevenus - 1]);
        }
        if (columns.colComment && hasComment) {
          commentMissing = isEmptyCell(existingEntry.row[columns.colComment - 1]);
        }
        if (columns.colNom && hasName) {
          nameMissing = isEmptyCell(existingEntry.row[columns.colNom - 1]);
        }
      }
      if (existingEntry) {
        if (priceMissing || commentMissing || nameMissing) {
          if (priceMissing && commentMissing) {
            status = 'price_comment_missing';
          } else if (priceMissing) {
            status = 'price_missing';
          } else if (commentMissing) {
            status = 'comment_missing';
          } else {
            status = 'name_missing';
          }

          const missingFields = [];
          if (priceMissing) missingFields.push('prix');
          if (commentMissing) missingFields.push('commentaire');
          if (nameMissing) missingFields.push('nom');
          if (missingFields.length) {
            reason = `${missingFields.join(' et ')} manquant${missingFields.length > 1 ? 's' : ''} dans la feuille`;
          }

          if (priceMissing) counts.priceMissing += 1;
          if (commentMissing) counts.commentMissing += 1;
          if (nameMissing) counts.nameMissing += 1;
          if (priceMissing && commentMissing) counts.priceCommentMissing += 1;
        } else {
          status = 'existing';
          reason = existingMatch.shifted
            ? 'déjà présent (arrivée iCal glissante)'
            : 'déjà présent';
          counts.existing += 1;
        }
      } else {
        counts.new += 1;
      }
    }

    if (r.giteName) {
      if (!byGite[r.giteName]) {
        byGite[r.giteName] = {
          total: 0,
          new: 0,
          existing: 0,
          priceMissing: 0,
          commentMissing: 0,
          nameMissing: 0,
          priceCommentMissing: 0,
          outsideYear: 0,
          invalid: 0,
          unknown: 0
        };
      }
      byGite[r.giteName].total += 1;
      if (status === 'new') byGite[r.giteName].new += 1;
      if (status === 'existing') byGite[r.giteName].existing += 1;
      if (priceMissing) byGite[r.giteName].priceMissing += 1;
      if (commentMissing) byGite[r.giteName].commentMissing += 1;
      if (nameMissing) byGite[r.giteName].nameMissing += 1;
      if (priceMissing && commentMissing) byGite[r.giteName].priceCommentMissing += 1;
      if (status === 'outside_year') byGite[r.giteName].outsideYear += 1;
      if (status === 'invalid') byGite[r.giteName].invalid += 1;
      if (status === 'unknown') byGite[r.giteName].unknown += 1;
    }

    const idRaw = `${r.giteId || 'unknown'}|${r.checkIn}|${r.checkOut}|${r.name || ''}|${r.type || ''}|${idx}`;
    const id = crypto.createHash('sha1').update(idRaw).digest('hex').slice(0, 12);

    return {
      id,
      ...r,
      status,
      reason,
      priceMissing,
      commentMissing,
      nameMissing
    };
  });

  return { reservations: reservationsPreview, counts, byGite };
}

function buildEmptyImportSummary() {
  return {
    inserted: 0,
    updated: 0,
    skipped: { duplicate: 0, invalid: 0, outsideYear: 0, unknown: 0 },
    perGite: {},
    insertedItems: []
  };
}

async function importReservationsToSheets(incomingReservations, options = {}) {
  const { allowCommentUpdate = true } = options;
  const summary = buildEmptyImportSummary();
  if (!Array.isArray(incomingReservations) || incomingReservations.length === 0) {
    return summary;
  }

  const token = await getAccessToken();
  const runId = new Date().toISOString();
  const grouped = {};

  for (const reservation of incomingReservations) {
    const giteId = reservation.giteId || resolveGiteId(reservation.giteName || reservation.listingName);
    if (!giteId) {
      if (!grouped.unknown) grouped.unknown = [];
      grouped.unknown.push(reservation);
      continue;
    }
    if (!grouped[giteId]) grouped[giteId] = [];
    grouped[giteId].push({ ...reservation, giteId });
  }

  if (grouped.unknown?.length) {
    summary.skipped.unknown += grouped.unknown.length;
  }

  for (const [giteId, items] of Object.entries(grouped)) {
    if (giteId === 'unknown') continue;
    const sheetName = SHEET_NAMES[giteId];
    if (!sheetName) {
      summary.skipped.unknown += items.length;
      continue;
    }

    const { header, rows } = await fetchSheetHeaderAndRows(sheetName, token);
    const columns = buildSheetColumns(header);
    const existingIndex = buildExistingReservationIndex(rows, columns, giteId);
    const existingKeys = new Set(existingIndex.keys());
    const sheetId = await getSheetId(sheetName, token);
    const rowsToInsert = [];
    const existingUpdates = [];
    const updatedKeys = new Set();

    for (const r of items) {
      const giteName = resolveGiteName(giteId, r.giteName || r.listingName);
      const sourceLabel = normalizeSourceLabel(r.source);
      const baseReservation = {
        type: r.type || 'personal',
        source: sourceLabel,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: r.nights,
        name: r.name || '',
        giteName,
        payout: typeof r.payout === 'number' ? r.payout : null,
        comment: r.comment || ''
      };
      const segments = splitReservationByMonth(baseReservation);

      for (const seg of segments) {
        const start = dayjs(seg.checkIn, 'YYYY-MM-DD', true);
        const end = dayjs(seg.checkOut, 'YYYY-MM-DD', true);
        if (!start.isValid() || !end.isValid()) {
          summary.skipped.invalid += 1;
          continue;
        }
        if (!overlapsCurrentYear(seg.checkIn, seg.checkOut)) {
          summary.skipped.outsideYear += 1;
          continue;
        }
        const key = `${giteId}|${seg.checkIn}|${seg.checkOut}`;
        const existingMatch = resolveExistingReservationMatch(existingIndex, columns, giteId, seg);
        const existingEntry = existingMatch?.entry || null;
        if (existingEntry) {
          const matchKey = existingMatch?.key || key;
          const prixValue = existingEntry.row[columns.colPrixNuit - 1];
          const revenusValue = existingEntry.row[columns.colRevenus - 1];
          const missingPrix = isEmptyCell(prixValue);
          const missingRevenus = isEmptyCell(revenusValue);
          const commentValue = typeof seg.comment === 'string' ? seg.comment.trim() : '';
          const hasComment = commentValue !== '';
          const nameValue = typeof seg.name === 'string' ? seg.name.trim() : '';
          const hasName = nameValue !== '';
          const missingComment = columns.colComment
            && hasComment
            && isEmptyCell(existingEntry.row[columns.colComment - 1]);
          const missingName = columns.colNom
            && hasName
            && isEmptyCell(existingEntry.row[columns.colNom - 1]);
          const canUpdatePrice = seg.type === 'airbnb' && typeof seg.payout === 'number';
          const needsPriceUpdate = canUpdatePrice && (missingPrix || missingRevenus);
          const needsCommentUpdate = allowCommentUpdate && missingComment;
          const needsNameUpdate = missingName;
          if (needsPriceUpdate || needsCommentUpdate || needsNameUpdate) {
            if (!updatedKeys.has(matchKey)) {
              const rowNumber = existingEntry.rowNumber;
              const updateStart = existingUpdates.length;
              if (needsPriceUpdate && missingRevenus) {
                const revenusCol = toColumnLetter(columns.colRevenus);
                existingUpdates.push({
                  range: `${sheetName}!${revenusCol}${rowNumber}`,
                  values: [[seg.payout]]
                });
              }
              if (needsPriceUpdate && missingPrix) {
                const nights = resolveNights(seg);
                if (nights > 0) {
                  const prixCol = toColumnLetter(columns.colPrixNuit);
                  existingUpdates.push({
                    range: `${sheetName}!${prixCol}${rowNumber}`,
                    values: [[seg.payout / nights]]
                  });
                }
              }
              if (needsCommentUpdate && columns.colComment) {
                const commentCol = toColumnLetter(columns.colComment);
                existingUpdates.push({
                  range: `${sheetName}!${commentCol}${rowNumber}`,
                  values: [[commentValue]]
                });
              }
              if (needsNameUpdate && columns.colNom) {
                const nomCol = toColumnLetter(columns.colNom);
                existingUpdates.push({
                  range: `${sheetName}!${nomCol}${rowNumber}`,
                  values: [[nameValue]]
                });
              }
              if (existingUpdates.length > updateStart) {
                summary.updated += 1;
                updatedKeys.add(matchKey);
              } else {
                summary.skipped.duplicate += 1;
              }
            }
          } else {
            summary.skipped.duplicate += 1;
          }
          continue;
        }

        if (existingKeys.has(key)) {
          summary.skipped.duplicate += 1;
          continue;
        }

        existingKeys.add(key);
        const { rowValues, payoutValue } = buildHarRowValues(seg, columns, runId);
        rowsToInsert.push({ reservation: seg, rowValues, payoutValue });
      }
    }

    if (rowsToInsert.length > 0) {
      const appendResult = await appendRowsValues(
        sheetName,
        rowsToInsert.map(item => item.rowValues),
        token
      );
      const startRow = appendResult?.startRow;
      if (!startRow) {
        throw new Error('Failed to resolve inserted rows');
      }

      const debutCol = toColumnLetter(columns.colDebut);
      const finCol = toColumnLetter(columns.colFin);
      const nuitsCol = toColumnLetter(columns.colNuits);
      const adultesCol = toColumnLetter(columns.colAdultes);
      const prixCol = toColumnLetter(columns.colPrixNuit);
      const revenusCol = toColumnLetter(columns.colRevenus);
      const adultsValue = giteId === 'liberte' ? 10 : 2;

      const updates = [...existingUpdates];
      rowsToInsert.forEach((item, index) => {
        const rowNumber = startRow + index;
        updates.push({
          range: `${sheetName}!${nuitsCol}${rowNumber}`,
          values: [[`=${finCol}${rowNumber}-${debutCol}${rowNumber}`]]
        });
        updates.push({
          range: `${sheetName}!${adultesCol}${rowNumber}`,
          values: [[adultsValue]]
        });

        if (item.reservation.type === 'airbnb') {
          const nights = resolveNights(item.reservation);
          const payoutValue = typeof item.payoutValue === 'number'
            ? item.payoutValue
            : typeof item.reservation.payout === 'number'
              ? item.reservation.payout
              : null;
          if (payoutValue != null && nights > 0) {
            updates.push({
              range: `${sheetName}!${prixCol}${rowNumber}`,
              values: [[payoutValue / nights]]
            });
          }
        } else if (item.reservation.type === 'personal') {
          updates.push({
            range: `${sheetName}!${revenusCol}${rowNumber}`,
            values: [[`=${prixCol}${rowNumber}*${nuitsCol}${rowNumber}`]]
          });
        }
      });

      await batchUpdateValues(updates, token);
      await highlightRange(sheetId, startRow, rowsToInsert.length, columns.highlightCols, token);

      summary.inserted += rowsToInsert.length;
      if (!summary.perGite[giteId]) summary.perGite[giteId] = 0;
      summary.perGite[giteId] += rowsToInsert.length;
      rowsToInsert.forEach(item => {
        summary.insertedItems.push({
          giteId,
          giteName: item.reservation.giteName || resolveGiteName(giteId),
          source: item.reservation.source || '',
          type: item.reservation.type || '',
          checkIn: item.reservation.checkIn,
          checkOut: item.reservation.checkOut
        });
      });
      await postProcessHarSheet({ sheetName, sheetId, columns, token });
    } else if (existingUpdates.length > 0) {
      await batchUpdateValues(existingUpdates, token);
    }
  }

  return summary;
}

async function insertHarReservation({ reservation, columns, giteId, sheetName, sheetId, token, runId }) {
  const { rowValues, payoutValue } = buildHarRowValues(reservation, columns, runId);
  const rowNumber = await appendRowValues(sheetName, rowValues, token);
  if (!rowNumber) throw new Error('Failed to resolve inserted row');

  const startDate = dayjs(reservation.checkIn, 'YYYY-MM-DD');
  const endDate = dayjs(reservation.checkOut, 'YYYY-MM-DD');
  const nights = startDate.isValid() && endDate.isValid()
    ? Math.max(endDate.diff(startDate, 'day'), 0)
    : 0;

  const debutCol = toColumnLetter(columns.colDebut);
  const finCol = toColumnLetter(columns.colFin);
  const nuitsCol = toColumnLetter(columns.colNuits);
  const prixCol = toColumnLetter(columns.colPrixNuit);

  await updateSingleCell(
    sheetName,
    columns.colNuits,
    rowNumber,
    `=${finCol}${rowNumber}-${debutCol}${rowNumber}`,
    token
  );

  const adultsValue = giteId === 'liberte' ? 10 : 2;
  await updateSingleCell(sheetName, columns.colAdultes, rowNumber, adultsValue, token);

  if (reservation.type === 'airbnb') {
    if (typeof payoutValue === 'number' && nights > 0) {
      const perNight = payoutValue / nights;
      await updateSingleCell(sheetName, columns.colPrixNuit, rowNumber, perNight, token);
    }
  }

  if (reservation.type === 'personal') {
    await updateSingleCell(
      sheetName,
      columns.colRevenus,
      rowNumber,
      `=${prixCol}${rowNumber}*${nuitsCol}${rowNumber}`,
      token
    );
  }

  if (columns.highlightCols > 0) {
    await highlightRow(sheetId, rowNumber, columns.highlightCols, token);
  }

  return rowNumber;
}

async function batchUpdateSheets(requests, token) {
  await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ requests })
    },
    { expectJson: true }
  );
}

async function updateRowValues(sheetName, rowNumber, rowValues, token) {
  const lastCol = toColumnLetter(rowValues.length);
  const range = `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`;
  await requestWrite(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ values: [rowValues] })
    },
    { expectJson: true }
  );
}

async function removeEmptyRows({ sheetName, sheetId, token, colCount }) {
  const lastCol = toColumnLetter(colCount);
  const rows = await fetchSheetValues(`${sheetName}!A2:${lastCol}`, token);
  if (!rows.length) return 0;

  const toDelete = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    let allEmpty = true;
    for (let c = 0; c < colCount; c++) {
      const val = row[c];
      if (val !== '' && val != null) {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) toDelete.push(i + 2);
  }

  if (!toDelete.length) return 0;
  const requests = toDelete
    .sort((a, b) => b - a)
    .map(rowNumber => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber
        }
      }
    }));
  await batchUpdateSheets(requests, token);
  return toDelete.length;
}

async function sortSheetByDate({ sheetId, sortColIndex, rowCount, colCount, token }) {
  if (rowCount <= 1 || sortColIndex < 0) return;
  await batchUpdateSheets(
    [
      {
        sortRange: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          sortSpecs: [{ dimensionIndex: sortColIndex, sortOrder: 'ASCENDING' }]
        }
      }
    ],
    token
  );
}

async function insertBlankRow(sheetId, rowNumber, token) {
  await batchUpdateSheets(
    [
      {
        insertDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          },
          inheritFromBefore: false
        }
      }
    ],
    token
  );
}

async function insertMonthSeparators({ sheetName, sheetId, token, dateColIndex, colCount }) {
  if (dateColIndex < 0) return 0;
  const dateColLetter = toColumnLetter(dateColIndex + 1);
  const dateValues = await fetchSheetValues(`${sheetName}!${dateColLetter}2:${dateColLetter}`, token);
  if (!dateValues.length) return 0;

  let previousYM = null;
  let offset = 0;
  const rowsToInsert = [];

  for (let i = 0; i < dateValues.length; i++) {
    const cellVal = dateValues[i] ? dateValues[i][0] : null;
    const iso = parseSheetDateToIso(cellVal);
    if (!iso) continue;
    const currentYM = iso.slice(0, 7);
    if (previousYM && currentYM !== previousYM) {
      const rowToInsert = 2 + i + offset;
      offset += 1;
      rowsToInsert.push(rowToInsert);
    }
    previousYM = currentYM;
  }

  if (!rowsToInsert.length) return 0;

  const insertRequests = rowsToInsert.map(rowNumber => ({
    insertDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowNumber - 1,
        endIndex: rowNumber
      },
      inheritFromBefore: false
    }
  }));
  await batchUpdateSheets(insertRequests, token);

  const lastCol = toColumnLetter(colCount);
  const emptyRow = Array(colCount).fill('');
  const updates = rowsToInsert.map(rowNumber => ({
    range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
    values: [emptyRow]
  }));
  await batchUpdateValues(updates, token);

  return rowsToInsert.length;
}

async function postProcessHarSheet({ sheetName, sheetId, columns, token }) {
  const colCount = getSheetRowLength(columns);
  await removeEmptyRows({ sheetName, sheetId, token, colCount });

  const lastCol = toColumnLetter(colCount);
  const rows = await fetchSheetValues(`${sheetName}!A2:${lastCol}`, token);
  const rowCount = rows.length + 1;
  const dateColIndex = columns.iDebut !== -1 ? columns.iDebut : columns.colDebut - 1;

  await sortSheetByDate({ sheetId, sortColIndex: dateColIndex, rowCount, colCount, token });
  await insertMonthSeparators({ sheetName, sheetId, token, dateColIndex, colCount });
}

const refreshingSheets = new Set();

function commentsKey(giteId, isoDate) {
  return `${giteId}_${isoDate}`;
}

async function fetchSheetRowsWithPhone(sheetName, token) {
  const valueRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!B2:K`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!valueRes.ok) {
    const text = await valueRes.text().catch(() => '');
    throw new Error(`Sheets values error ${valueRes.status}: ${text}`);
  }
  const valueData = await valueRes.json();
  return valueData.values || [];
}

async function refreshCommentsForAllGitesInRange(startIso, endIso) {
  const token = await getAccessToken();
  const startDate = dayjs(startIso, 'YYYY-MM-DD');
  const endDate = dayjs(endIso, 'YYYY-MM-DD');
  const currentCache = readCommentsCache();
  const updatedCache = { ...currentCache };

  for (const [giteId, sheetName] of Object.entries(SHEET_NAMES)) {
    const sheetKey = `range:${sheetName}`;
    if (refreshingSheets.has(sheetKey)) continue;
    refreshingSheets.add(sheetKey);
    try {
      const rows = await fetchSheetRowsWithPhone(sheetName, token);
      for (const row of rows) {
        const rowDate = dayjs(row[0], 'DD/MM/YYYY');
        if (!rowDate.isValid()) continue;
        if (rowDate.isBefore(startDate) || rowDate.isAfter(endDate)) continue;
        const key = commentsKey(giteId, rowDate.format('YYYY-MM-DD'));
        const comment = row[8] && row[8].trim() ? row[8] : '';
        const phone = row[9] && row[9].trim() ? row[9] : '';
        const prev = updatedCache[key] || {};
        if (prev.comment !== comment || prev.phone !== phone) {
          updatedCache[key] = {
            comment,
            phone,
            updatedAt: new Date().toISOString()
          };
        }
      }
    } catch (e) {
      console.error(`Failed to refresh comments for ${sheetName}:`, e.message);
    } finally {
      refreshingSheets.delete(sheetKey);
    }
  }

  // Write if changed
  const before = JSON.stringify(currentCache);
  const after = JSON.stringify(updatedCache);
  if (before !== after) await writeCommentsCache(updatedCache);
}

async function refreshSingleComment(giteId, isoDate) {
  const sheetName = SHEET_NAMES[giteId];
  if (!sheetName) return;
  const token = await getAccessToken();
  const sheetKey = `single:${sheetName}`;
  if (refreshingSheets.has(sheetKey)) return;
  refreshingSheets.add(sheetKey);
  try {
    const rows = await fetchSheetRowsWithPhone(sheetName, token);
    const target = dayjs(isoDate, 'YYYY-MM-DD').format('DD/MM/YYYY');
    let found = null;
    for (const row of rows) {
      if ((row[0] || '').trim() === target) {
        const comment = row[8] && row[8].trim() ? row[8] : '';
        const phone = row[9] && row[9].trim() ? row[9] : '';
        found = { comment, phone };
        break;
      }
    }
    if (found) {
      const cache = readCommentsCache();
      const key = commentsKey(giteId, isoDate);
      const prev = cache[key] || {};
      if (prev.comment !== found.comment || prev.phone !== found.phone) {
        cache[key] = { ...found, updatedAt: new Date().toISOString() };
        await writeCommentsCache(cache);
      }
    }
  } catch (e) {
    console.error(`Failed to refresh single comment for ${giteId}/${isoDate}:`, e.message);
  } finally {
    refreshingSheets.delete(sheetKey);
  }
}

// --- School holidays cache ---
const holidaysCache = {};



/**
 * @param {number} year - ex: 2025 -> "2025-2026"
 * @param {Object} [opts]
 * @param {string[]} [opts.zones=['A','B','C']]  // filtrage côté client
 * @param {string|null} [opts.population=null]   // ex: "Élèves" | "Enseignants" (pas de filtre si null)
 */
async function fetchHolidaysForYear(year, opts = {}) {
  const { zones = ['A','B','C'], population = null } = opts;
  const academicYear = `${year}-${year + 1}`;
  const pageSize = 100; // MAX autorisé par l’API
  let offset = 0;

  const allRows = [];

  try {
    while (true) {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        order_by: 'start_date',
      });
      params.append('refine', `annee_scolaire:${academicYear}`);
      if (population) params.append('refine', `population:${population}`);

      const url = `${SCHOOL_DATASET_BASE}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const chunk = Array.isArray(json.results) ? json.results : [];
      allRows.push(...chunk);

      if (chunk.length < pageSize) break; // dernière page atteinte
      offset += pageSize;
    }

    // Normalisation
    const holidays = [];
    for (const item of allRows) {
      const rawZones = (item.zones ?? '').toString();
      const normalizedZones = rawZones
        .split(/[/,;]| et /i)
        .map(s => s.trim())
        .filter(Boolean)
        .map(z => z.replace(/Zone\s*/i, '').trim()); // "Zone A" -> "A"

      const start = (item.start_date || '').slice(0, 10);
      const end   = (item.end_date   || '').slice(0, 10);
      const description =
        item.description || item.vacances || item.intitule || '';
      const recordPopulation = item.population || '';

      const zonesToPush = normalizedZones.length ? normalizedZones : [''];
      for (const z of zonesToPush) {
        if (z && zones.length && !zones.includes(z)) continue;
        holidays.push({
          zone: z || '—',
          start,
          end,
          description,
          anneeScolaire: item.annee_scolaire || academicYear,
          population: recordPopulation,
        });
      }
    }

    holidaysCache[year] = holidays;
    console.log(
      `Fetched ${holidays.length} holiday items from ${allRows.length} rows for ${academicYear} (${year})`
    );
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

// --- Helpers: summary filters and dedup ---
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

  // Include filter: require at least one match if provided
  if (includes.length > 0) {
    const ok = includes.some(n => summaryMatches(summary, n));
    if (!ok) return false;
  }
  // Exclude filter: drop if any match
  if (excludes.length > 0) {
    const bad = excludes.some(n => summaryMatches(summary, n));
    if (bad) return false;
  }
  return true;
}

function dedupeReservations(list) {
  // 1) Dédoublonnage strict: même (giteId, debut, fin)
  const byPeriod = new Map();
  for (const ev of list) {
    const key = `${ev.giteId}|${ev.debut}|${ev.fin}`;
    const prev = byPeriod.get(key);
    if (!prev) {
      byPeriod.set(key, ev);
      continue;
    }
    const better = preferReservation(prev, ev);
    byPeriod.set(key, better);
  }

  const winners = Array.from(byPeriod.values());

  // 2) Fusion supplémentaire: même (giteId, fin) même jour de sortie
  const byEnd = new Map();
  for (const ev of winners) {
    const key = `${ev.giteId}|${ev.fin}`;
    const prev = byEnd.get(key);
    if (!prev) {
      byEnd.set(key, ev);
      continue;
    }
    const better = preferReservation(prev, ev);
    byEnd.set(key, better);
  }

  return Array.from(byEnd.values());
}

function preferReservation(a, b) {
  const aPref = isReservedOrBooked(a.resume);
  const bPref = isReservedOrBooked(b.resume);
  let winner;
  if (aPref && !bPref) winner = a;
  else if (!aPref && bPref) winner = b;
  else {
    // Sinon, choisir celle qui commence le plus tôt (couvre la période la plus longue)
    const aStart = dayjs(a.debut, 'YYYY-MM-DD');
    const bStart = dayjs(b.debut, 'YYYY-MM-DD');
    if (aStart.isValid() && bStart.isValid()) {
      winner = aStart.isBefore(bStart) ? a : b;
    } else {
      winner = a; // fallback stable
    }
  }

  // Fusion légère: conserver un éventuel airbnbUrl si présent sur l'un des deux
  const merged = { ...winner };
  if (!merged.airbnbUrl && a.airbnbUrl) merged.airbnbUrl = a.airbnbUrl;
  if (!merged.airbnbUrl && b.airbnbUrl) merged.airbnbUrl = b.airbnbUrl;
  return merged;
}

function isReservedOrBooked(summary) {
  if (!summary) return false;
  const s = String(summary).trim().toUpperCase();
  return s === 'RESERVED' || s === 'BOOKED';
}

// Extrait l'URL de réservation Airbnb depuis la description iCal, si présente
function extractAirbnbUrl(description) {
  if (!description) return '';
  const text = String(description);
  // Format typique: "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/..."
  const m = text.match(/Reservation URL:\s*(https?:\/\/\S+)/i);
  if (m && m[1]) return m[1].trim();
  // Repli: capturer tout lien airbnb dans la description
  const m2 = text.match(/https?:\/\/(?:www\.)?airbnb\.[^\s\n]+/i);
  if (m2 && m2[0]) return m2[0].trim();
  return '';
}

// Stockage en mémoire des réservations et des erreurs
let reservations = [];
let erreurs = new Set();
let icalLoadPromise = null;

/**
 * Chargement et parsing de toutes les sources ical.
 * Cette fonction est exécutée une seule fois au démarrage du serveur.
 */
async function chargerCalendriers() {
  console.time('ical-load');
  for (const gite of GITES) {
    for (const source of gite.sources) {
      try {
        const res = await fetch(source.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
          }
        });
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter) {
          console.log('Retry-After reçu pour', source.url, ':', retryAfter);
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();

        // Parsing du contenu ical
        const data = ical.parseICS(text);
        for (const ev of Object.values(data)) {
          if (ev.type === 'VEVENT') {
            let typeSource = source.type;
            // Si le summary contient "Airbnb (Not available)", on garde "Airbnb"
            // pour la source de réservation.

            // Filtrage générique par summary via la config de la source
            if (!shouldKeepBySummary(ev.summary, source)) {
              continue;
            }

            // Tentative d'extraction d'une URL Airbnb depuis la description iCal
            const airbnbUrl =
              typeSource === 'Airbnb' ? extractAirbnbUrl(ev.description) : '';

            reservations.push({
              giteId: gite.id,
              giteNom: gite.nom,
              couleur: gite.couleur,
              source: typeSource,
              debut: formatIcalDate(ev.start), // Date d'arrivée, fiable !
              fin: formatIcalDate(ev.end),     // Date de départ (le client part ce matin-là)
              resume: ev.summary || '',
              airbnbUrl: airbnbUrl || ''
            });
            // console.log("DEBUG ev.start", ev.start, ev.start.toISOString());
          }
        }
        console.log('Chargement réussi pour', gite.nom, 'depuis', source.type);
      } catch (err) {
        // En cas d'erreur, on stocke l'identifiant du gîte
        erreurs.add(gite.id);
        console.error('Erreur de chargement pour', gite.nom, err.message);
      }
    }
  }

  // Filtrage des événements à partir de J-5
  const today = dayjs().startOf('day');
  const startWindow = today.subtract(5, 'day');
  reservations = reservations.filter(ev => {
    const fin = dayjs(ev.fin);
    return fin.isAfter(startWindow);
  });

  // Déduplication: si deux sources donnent la même période pour le même gîte,
  // on conserve l'événement dont le SUMMARY est "Reserved" ou "BOOKED".
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
  } catch (err) {
    // L'erreur est déjà loguée, on répond avec l'état actuel.
  }
}

function formatIcalDate(d) {
  if (!d) return null;

  // Cas typique : Date iCal "all-day" → 22h UTC (minuit Paris)
  // On force la date à Europe/Paris, puis on récupère la date locale
  const local = new Date(d.getTime() + (2 * 60 * 60 * 1000)); // +2h (été)
  // Optionnel : détecte si l'heure est 22h ou 23h pour gérer l’hiver
  let hour = d.getUTCHours();
  if (hour === 22) { // Heure d’été
    return dayjs(d).add(2, 'hour').format('YYYY-MM-DD');
  }
  if (hour === 23) { // Heure d’hiver
    return dayjs(d).add(1, 'hour').format('YYYY-MM-DD');
  }
  // Cas normal (heure != 22 ou 23)
  return dayjs(d).format('YYYY-MM-DD');
}


// Chargement des calendriers au démarrage (en arrière-plan)
startIcalLoad({ reset: true });

// Endpoint de debug pour inspecter les doublons et le dédoublonnage
// Usage: GET /api/debug-duplicates?giteId=gree&day=YYYY-MM-DD
app.get('/api/debug-duplicates', (req, res) => {
  const { giteId } = req.query;
  let { day } = req.query;
  if (!day) {
    day = dayjs().add(1, 'day').format('YYYY-MM-DD'); // par défaut: demain
  }

  // Filtrer les réservations par gîte si fourni
  let subset = Array.isArray(reservations) ? reservations.slice() : [];
  if (giteId) subset = subset.filter(r => r.giteId === giteId);

  // Garder les événements qui couvrent la date ciblée [debut, fin)
  subset = subset.filter(r => {
    const start = dayjs(r.debut, 'YYYY-MM-DD');
    const end = dayjs(r.fin, 'YYYY-MM-DD');
    const target = dayjs(day, 'YYYY-MM-DD');
    return target.isSame(start, 'day') || (target.isAfter(start, 'day') && target.isBefore(end, 'day'));
  });

  // Grouper par même période
  const groups = {};
  for (const r of subset) {
    const key = `${r.giteId}|${r.debut}|${r.fin}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const duplicateGroups = Object.entries(groups)
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({
      key,
      count: arr.length,
      items: arr.map(x => ({ source: x.source, resume: x.resume, debut: x.debut, fin: x.fin }))
    }));

  // Grouper par même jour de sortie
  const groupsByEnd = {};
  for (const r of subset) {
    const key = `${r.giteId}|${r.fin}`;
    if (!groupsByEnd[key]) groupsByEnd[key] = [];
    groupsByEnd[key].push(r);
  }
  const duplicateEndGroups = Object.entries(groupsByEnd)
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({
      key,
      count: arr.length,
      items: arr.map(x => ({ source: x.source, resume: x.resume, debut: x.debut, fin: x.fin }))
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
  const filtered = zone ? data.filter(h => h.zone === zone) : data;
  res.json(filtered);
});

function buildIcalFlatReservations() {
  const flat = [];
  const sourceReservations = Array.isArray(reservations) ? reservations : [];
  for (const item of sourceReservations) {
    const giteId = item.giteId || null;
    const giteName = item.giteNom || item.giteName || '';
    const sheetName = giteId ? SHEET_NAMES[giteId] : null;
    const type = item.source === 'Airbnb' ? 'airbnb' : 'personal';
    const baseReservation = {
      type,
      checkIn: item.debut,
      checkOut: item.fin,
      nights: null,
      name: '',
      payout: null,
      comment: item.resume || ''
    };
    const segments = splitReservationByMonth(baseReservation);
    for (const seg of segments) {
      flat.push({
        giteId,
        giteName,
        sheetName,
        source: normalizeSourceLabel(item.source),
        ...seg
      });
    }
  }
  return flat;
}

// --- Servir le build React ---
// Chemin absolu vers le dossier build de React
const buildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(buildPath));

// Pour toutes les routes qui ne sont pas API, servir index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Serveur démarré sur le port', PORT);
});
