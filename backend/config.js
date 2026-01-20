import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SHEET_NAMES = {
  phonsine: 'Phonsine',
  gree: 'Gree',
  edmond: 'Edmond',
  liberte: 'Liberté'
};

export const RUN_COL_INDEX = 15;
export const HAR_HIGHLIGHT_COLOR = { red: 1, green: 0.976, blue: 0.769 };
export const WRITE_THROTTLE_MS = 1100;
export const WRITE_RETRY_LIMIT = 5;
export const WRITE_BACKOFF_BASE_MS = 500;
export const WRITE_BACKOFF_MAX_MS = 8000;

export const STATUS_FILE = path.join(__dirname, 'statuses.json');
export const DATA_FILE = path.join(__dirname, 'data.json');
export const COMMENTS_FILE = path.join(__dirname, 'comments-cache.json');
export const IMPORT_LOG_FILE = path.join(__dirname, 'import-log.json');
export const IMPORT_LOG_LIMIT = 20;

export const SCHOOL_DATASET_BASE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

// Chaque gîte possède plusieurs URLs ical, correspondant à différentes plateformes de réservation.
export const GITES = [
  {
    id: 'phonsine',
    nom: 'Gîte de Phonsine',
    couleur: '#E53935', // rouge
    sources: [
      { url: 'https://www.airbnb.fr/calendar/ical/6668903.ics?s=3610ebea31b864e7d5091b80938c221e', type: 'Airbnb' },
      { url: 'http://www.abritel.fr/icalendar/ddd9339eb15b46a6acc3f1f24f2b0f50.ics?nonTentative', type: 'Abritel' },
      { url: 'https://ics.itea.fr/gites56/56G14513/airbnb/ical_b096e61c56037c6af65124495dc06bef.ics', type: 'Gites de France', includeSummary: 'BOOKED' }
    ]
  },
  {
    id: 'liberte',
    nom: 'Gîte Le Liberté',
    couleur: '#8E24AA', // violet
    sources: [
      { url: 'https://www.airbnb.fr/calendar/ical/48504640.ics?s=c27d399e029a03b6b4dd791fbf026fee', type: 'Airbnb' },
      { url: 'http://www.abritel.fr/icalendar/094a7b5f6cf345f9b51940e07e588ab2.ics', type: 'Abritel' },
      { url: 'https://reservation.itea.fr/iCal_70b69a7451324ef50d43907fdb8b5c81.ics?aicc=f3792c7c79df6c160a2518bf3c55e9e6', type: 'Gites de France', includeSummary: 'BOOKED' }
    ]
  },
  {
    id: 'gree',
    nom: 'Gîte de la Grée',
    couleur: '#3949AB', // bleu
    sources: [
      { url: 'http://www.abritel.fr/icalendar/3d33e48aeded478f8c11deda36f20008.ics?nonTentative', type: 'Abritel' },
      { url: 'https://www.airbnb.fr/calendar/ical/16674752.ics?s=54a0101efa1112c86756ed2184506173', type: 'Airbnb' },
      { url: 'https://www.airbnb.fr/calendar/ical/1256595615494549883.ics?s=61ea920c4f6392380d88563f08adcfee', type: 'Airbnb', includeSummary: 'Reserved' },
      { url: 'https://ics.itea.fr/gites56/56G14515/airbnb/ical_df6826eb2adf6af43537405cd7d3f872.ics', type: 'Gites de France', includeSummary: 'BOOKED' }
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
