import dotenv from 'dotenv'; // Change from require('dotenv')
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import ical from 'node-ical';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js'; // <-- Add this line
import 'dayjs/locale/fr.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';


// Pour avoir __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './.env') }); // <-- Changed line

// Configuration locale française pour dayjs
// permet d'avoir des dates formatées "lundi 31/12/2025"
dayjs.extend(customParseFormat);
dayjs.locale('fr');

const app = express();
app.use(cors());
app.use(express.json());

const spreadsheetId = process.env.SPREAD_SHEET_ID;
const SHEET_NAMES = {
  phonsine: 'Phonsine',
  gree: 'Gree',
  edmond: 'Edmond',
  liberte: 'Liberté'
};

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const creds = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })
  );
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = base64url(sign.sign(creds.private_key));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token request failed');
  return data.access_token;
}

async function getSheetId(sheetName, token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  return sheet.properties.sheetId;
}

// Fichier de stockage des statuts
const STATUS_FILE = path.join(__dirname, 'statuses.json');

// Fichier de stockage des tarifs
const PRICES_FILE = path.join(__dirname, 'prices.json');

function readStatuses() {
  if (!fs.existsSync(STATUS_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
}

function writeStatuses(data) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

function readPrices() {
  if (!fs.existsSync(PRICES_FILE)) return [];
  return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'));
}

function writePrices(data) {
  fs.writeFileSync(PRICES_FILE, JSON.stringify(data, null, 2));
}

// --- School holidays cache ---
const holidaysCache = {};



const SCHOOL_DATASET_BASE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

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

// --- Définition des gîtes et de leurs sources ical ---
// Chaque gîte possède plusieurs URLs ical, correspondant à
// différentes plateformes de réservation.
const GITES = [
  {
    id: 'phonsine',
    nom: 'Gîte de Phonsine',
    couleur: '#E53935', // rouge
    sources: [
      { url: 'https://www.airbnb.fr/calendar/ical/6668903.ics?s=3610ebea31b864e7d5091b80938c221e', type: 'Airbnb' },
      { url: 'http://www.abritel.fr/icalendar/ddd9339eb15b46a6acc3f1f24f2b0f50.ics?nonTentative', type: 'Abritel' }
    ]
  },
  {
    id: 'liberte',
    nom: 'Gîte Le Liberté',
    couleur: '#8E24AA', // violet
    sources: [
      { url: 'https://www.airbnb.fr/calendar/ical/48504640.ics?s=c27d399e029a03b6b4dd791fbf026fee', type: 'Airbnb' },
      { url: 'http://www.abritel.fr/icalendar/094a7b5f6cf345f9b51940e07e588ab2.ics', type: 'Abritel' },
      { url: 'https://reservation.itea.fr/iCal_70b69a7451324ef50d43907fdb8b5c81.ics?aicc=f3792c7c79df6c160a2518bf3c55e9e6', type: 'Gites de France' }
    ]
  },
  {
    id: 'gree',
    nom: 'Gîte de la Grée',
    couleur: '#3949AB', // bleu
    sources: [
      { url: 'http://www.abritel.fr/icalendar/3d33e48aeded478f8c11deda36f20008.ics?nonTentative', type: 'Abritel' },
      { url: 'https://www.airbnb.fr/calendar/ical/16674752.ics?s=54a0101efa1112c86756ed2184506173', type: 'Airbnb' }
    ]
  },
  {
    id: 'edmond',
    nom: "Gîte de l'oncle Edmond",
    couleur: '#43A047', // vert
    sources: [
      { url: 'https://www.airbnb.fr/calendar/ical/43504621.ics?s=ff78829f694b64d20d1c56c81b319d1f', type: 'Airbnb' }
    ]
  }
];

// Stockage en mémoire des réservations et des erreurs
let reservations = [];
let erreurs = new Set();

/**
 * Chargement et parsing de toutes les sources ical.
 * Cette fonction est exécutée une seule fois au démarrage du serveur.
 */
async function chargerCalendriers() {
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
            // Si le summary contient "Airbnb (Not available)"
            // alors on considère la réservation comme directe
            if (
              typeSource === 'Airbnb' &&
              typeof ev.summary === 'string' &&
              ev.summary.includes('Airbnb (Not available)')
            ) {
              typeSource = 'Direct';
            }

            if (
              source.type === 'Gites de France' &&
              ev.summary !== 'BOOKED'
            ) {
              continue;
            }

            reservations.push({
              giteId: gite.id,
              giteNom: gite.nom,
              couleur: gite.couleur,
              source: typeSource,
              debut: formatIcalDate(ev.start), // Date d'arrivée, fiable !
              fin: formatIcalDate(ev.end),     // Date de départ (le client part ce matin-là)
              resume: ev.summary || ''
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


// Chargement des calendriers au démarrage
await chargerCalendriers();

// --- Endpoint JSON ---
app.get('/api/arrivals', (req, res) => {
  const today = dayjs().startOf('day');
  const startWindow = today.subtract(5, 'day');
  const endWindow = reservations.reduce((max, ev) => {
    const fin = dayjs(ev.fin);
    return fin.isAfter(max) ? fin : max;
  }, startWindow);
  const dates = [];
  for (let d = startWindow; !d.isAfter(endWindow); d = d.add(1, 'day')) {
    dates.push(d.format('YYYY-MM-DD'));
  }
  res.json({
    genereLe: new Date().toISOString(),
    reservations,
    erreurs: Array.from(erreurs),
    dates
  });
});

app.post('/api/reload-icals', async (req, res) => {
  try {
    reservations = [];
    erreurs = new Set();
    await chargerCalendriers();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/school-holidays', (req, res) => {
  const year = parseInt(req.query.year, 10) || dayjs().year();
  const zone = req.query.zone ? req.query.zone.toUpperCase() : 'B';
  const data = holidaysCache[year] || [];
  const filtered = zone ? data.filter(h => h.zone === zone) : data;
  res.json(filtered);
});

// Récupération des statuts
app.get('/api/statuses', (req, res) => {
  res.json(readStatuses());
});

// Mise à jour d'un statut
app.post('/api/statuses/:id', (req, res) => {
  const statuses = readStatuses();
  statuses[req.params.id] = { done: req.body.done, user: req.body.user };
  writeStatuses(statuses);
  res.json(statuses[req.params.id]);
});

// Gestion des tarifs
app.get('/api/prices', (req, res) => {
  res.json(readPrices());
});

app.post('/api/prices', (req, res) => {
  writePrices(req.body || []);
  res.json({ success: true });
});

app.post('/api/save-reservation', async (req, res) => {
  try {
    const { giteId, name, start, end, summary, price } = req.body;
    const sheetName = SHEET_NAMES[giteId];
    if (!sheetName) return res.status(400).json({ success: false, error: 'Invalid gite' });

    const token = await getAccessToken();
    const sheetId = await getSheetId(sheetName, token);

    const valueRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!B2:C`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const valueData = await valueRes.json();
    const rows = valueData.values || [];
    const startDate = dayjs(start, 'DD/MM/YYYY');
    const endDate = dayjs(end, 'DD/MM/YYYY');

    let idx = rows.findIndex(r => {
      const rowStart = dayjs(r[0], 'DD/MM/YYYY');
      const rowEnd = dayjs(r[1], 'DD/MM/YYYY');
      return startDate.isBefore(rowStart) || (startDate.isSame(rowStart) && endDate.isBefore(rowEnd));
    });
    if (idx === -1) idx = rows.length;
    const insertRow = idx + 2;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        requests: [
          {
            insertDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: insertRow - 1, endIndex: insertRow },
              inheritFromBefore: false
            }
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: insertRow - 1,
                endRowIndex: insertRow,
                startColumnIndex: 0,
                endColumnIndex: 10
              },
              cell: { userEnteredFormat: { backgroundColor: { red: 0.8, green: 0.9, blue: 1 } } },
              fields: 'userEnteredFormat.backgroundColor'
            }
          }
        ]
      })
    });

    const priceValue = typeof price === 'number' ? price : '';

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${insertRow}:J${insertRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          values: [[name, start, end, '', '', '', priceValue, '', '', summary.replace(/\n/g, ' ')]]
        })
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Servir le build React ---
// Chemin absolu vers le dossier build de React
const buildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(buildPath));

// Pour toutes les routes qui ne sont pas API, servir index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Serveur démarré sur le port', PORT);
});
