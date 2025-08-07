import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import ical from 'node-ical';
import dayjs from 'dayjs';
import 'dayjs/locale/fr.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Pour avoir __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Petite fonction utilitaire pour temporiser des actions asynchrones
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Configuration locale française pour dayjs
// permet d'avoir des dates formatées "lundi 31/12/2025"
dayjs.locale('fr');

const app = express();
app.use(cors());
app.use(express.json());

// Fichier de stockage des statuts
const STATUS_FILE = path.join(__dirname, 'statuses.json');

function readStatuses() {
  if (!fs.existsSync(STATUS_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
}

function writeStatuses(data) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

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
      { url: 'https://www.airbnb.fr/calendar/ical/1182344118629001592.ics?s=641548df33ebc6bf6b5f383c7aec25ac', type: 'Airbnb' },
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
      { url: 'https://www.airbnb.fr/calendar/ical/16674752.ics?s=54a0101efa1112c86756ed2184506173', type: 'Airbnb' },
      { url: 'https://www.airbnb.fr/calendar/ical/1256595615494549883.ics?s=61ea920c4f6392380d88563f08adcfee', type: 'Airbnb' }
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
  // mémorise la date de la dernière requête ical Airbnb
  let dernierFetchAirbnb = 0;

  for (const gite of GITES) {
    for (const source of gite.sources) {
      try {
        // Si la source provient d'Airbnb, on s'assure qu'au moins 500 ms se sont écoulées
        if (source.type === 'Airbnb') {
          const now = Date.now();
          const attente = 100 - (now - dernierFetchAirbnb);
          if (attente > 0) {
            await sleep(attente);
          }
          dernierFetchAirbnb = Date.now();
        }

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

            reservations.push({
              giteId: gite.id,
              giteNom: gite.nom,
              couleur: gite.couleur,
              source: typeSource,
              debut: ev.start, // Date d'arrivée
              fin: ev.end,
              resume: ev.summary || ''
            });
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

  // Filtrage des événements qui chevauchent les 7 prochains jours
  const aujourdHui = dayjs().startOf('day');
  const limite = aujourdHui.add(7, 'day');
  reservations = reservations.filter(ev => {
    const debut = dayjs(ev.debut);
    const fin = dayjs(ev.fin);
    return debut.isBefore(limite) && fin.isAfter(aujourdHui.subtract(1, 'day'));
  });
}

// Chargement des calendriers au démarrage
await chargerCalendriers();

// --- Endpoint JSON ---
app.get('/api/arrivals', (req, res) => {
  res.json({
    genereLe: new Date().toISOString(),
    reservations,
    erreurs: Array.from(erreurs)
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
