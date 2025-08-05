import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CalendarBar from './components/CalendarBar';
import ArrivalsList from './components/ArrivalsList';
import Loader from './components/Loader';
import { fetchArrivals } from './services/api';
import { Box } from '@mui/material';
import Legend from './components/Legend';

// Clé utilisée pour mémoriser l'authentification en localStorage
const AUTH_KEY = 'wt-authenticated';

function App() {
  const [auth, setAuth] = useState(localStorage.getItem(AUTH_KEY) === 'true');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reservations: [], erreurs: [] });

  // Chargement des données après authentification
  useEffect(() => {
    if (!auth) return;
    fetchArrivals()
      .then(setData)
      .finally(() => setLoading(false));
  }, [auth]);

  // Fonction de validation du mot de passe
  const handleLogin = password => {
    const expected = process.env.REACT_APP_PASSWORD || 'secret';
    if (password === expected) {
      localStorage.setItem(AUTH_KEY, 'true');
      setAuth(true);
    }
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  if (loading) return <Loader />;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
      <CalendarBar bookings={data.reservations} errors={data.erreurs} />
      <Legend bookings={data.reservations} />
      <ArrivalsList bookings={data.reservations} errors={data.erreurs} />
    </Box>
  );
}

export default App;
