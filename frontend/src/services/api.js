const IS_PROD = import.meta.env.PROD;
const API_BASE = IS_PROD ? '' : 'http://localhost:3001';

const ARRIVALS_URL = `${API_BASE}/api/arrivals`;
const STATUS_URL = `${API_BASE}/api/statuses`;
const REFRESH_URL = `${API_BASE}/api/reload-icals`;
export const SAVE_RESERVATION = `${API_BASE}/api/save-reservation`;
const PRICES_URL = `${API_BASE}/api/prices`;
const TEXTS_URL = `${API_BASE}/api/texts`;
const DATA_URL = `${API_BASE}/api/data`;
const HOLIDAYS_URL = `${API_BASE}/api/school-holidays`;
const PUBLIC_HOLIDAYS_URL = 'https://calendrier.api.gouv.fr/jours-feries/metropole.json';
const COMMENTS_URL = `${API_BASE}/api/comments-range`;

export async function fetchArrivals() {
  const res = await fetch(ARRIVALS_URL);
  console.log('fetchArrivals:', ARRIVALS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  console.log('fetchArrivals response:', res);
  return res.json();
}

export async function fetchStatuses() {
  const res = await fetch(STATUS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function updateStatus(id, done, user) {
  const res = await fetch(`${STATUS_URL}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done, user })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function refreshCalendars() {
  const res = await fetch(REFRESH_URL, { method: 'POST' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchComments(start, end) {
  const res = await fetch(`${COMMENTS_URL}?start=${start}&end=${end}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchSchoolHolidays() {
  const res = await fetch(HOLIDAYS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchPublicHolidays() {
  const res = await fetch(PUBLIC_HOLIDAYS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchPrices() {
  const res = await fetch(PRICES_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function savePrices(data) {
  const res = await fetch(PRICES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchTexts() {
  const res = await fetch(TEXTS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function saveTexts(data) {
  const res = await fetch(TEXTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function saveData(data) {
  const res = await fetch(DATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
