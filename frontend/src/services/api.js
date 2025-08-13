const IS_PROD = process.env.NODE_ENV === 'production';
const API_BASE = IS_PROD ? '' : 'http://localhost:3001';

const ARRIVALS_URL = `${API_BASE}/api/arrivals`;
const STATUS_URL = `${API_BASE}/api/statuses`;
const REFRESH_URL = `${API_BASE}/api/reload-icals`;
export const SAVE_RESERVATION = `${API_BASE}/api/save-reservation`;
const HOLIDAYS_URL = `${API_BASE}/api/school-holidays`;

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

export async function fetchSchoolHolidays() {
  const res = await fetch(HOLIDAYS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
