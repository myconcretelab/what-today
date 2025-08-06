const ARRIVALS_URL = process.env.REACT_APP_API_URL || '/api/arrivals';
const STATUS_URL = '/api/statuses';

export async function fetchArrivals() {
  const res = await fetch(ARRIVALS_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
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
