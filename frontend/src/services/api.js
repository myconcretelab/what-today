// Appels au backend pour récupérer les arrivées
const API_URL = process.env.REACT_APP_API_URL || '/api/arrivals';

export async function fetchArrivals() {
  const res = await fetch(API_URL);
  console.log('fetchArrivals called : ' + API_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  console.log('fetchArrivals response:', res);
  return res.json();
}
