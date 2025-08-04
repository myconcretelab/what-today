// Appels au backend pour récupérer les arrivées
export async function fetchArrivals() {
  const res = await fetch('/api/arrivals');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
