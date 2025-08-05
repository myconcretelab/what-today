// Appels au backend pour récupérer les arrivées
export async function fetchArrivals() {
  const res = await fetch('api/arrivals');
  console.log('fetchArrivals called');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  console.log('fetchArrivals response:', res);
  return res.json();
}
