import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CalendarBar from './components/CalendarBar';
import ArrivalsList from './components/ArrivalsList';
import Loader from './components/Loader';
import { fetchArrivals, fetchStatuses, updateStatus } from './services/api';
import { Box } from '@mui/material';
import Legend from './components/Legend';

// Clé utilisée pour mémoriser l'authentification en localStorage
const AUTH_KEY = 'wt-authenticated';

function App() {
  const [auth, setAuth] = useState(localStorage.getItem(AUTH_KEY) === 'true');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reservations: [], erreurs: [] });
  const [statuses, setStatuses] = useState({});
  const USER_KEY = 'wt-user';
  const [selectedUser, setSelectedUser] = useState(
    localStorage.getItem(USER_KEY) || 'Soaz'
  );
  const [refreshing, setRefreshing] = useState(false);

  // Chargement des données après authentification
  useEffect(() => {
    if (!auth) return;
    loadData().finally(() => setLoading(false));
  }, [auth]);

  const loadData = async () => {
    const [arr, stat] = await Promise.all([fetchArrivals(), fetchStatuses()]);
    setData(arr);
    setStatuses(stat);
  };

  // Fonction de validation du mot de passe
  const handleLogin = password => {
    const expected = process.env.REACT_APP_PASSWORD || 'secret';
    if (password === expected) {
      localStorage.setItem(AUTH_KEY, 'true');
      setAuth(true);
    }
  };

  const handleStatusChange = (id, done) => {
    updateStatus(id, done, selectedUser).then(() => {
      setStatuses(prev => ({ ...prev, [id]: { done, user: selectedUser } }));
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  if (loading) return <Loader />;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
      <CalendarBar bookings={data.reservations} errors={data.erreurs} />
      <Legend
        bookings={data.reservations}
        selectedUser={selectedUser}
        onUserChange={user => {
          setSelectedUser(user);
          localStorage.setItem(USER_KEY, user);
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      <ArrivalsList
        bookings={data.reservations}
        errors={data.erreurs}
        statuses={statuses}
        onStatusChange={handleStatusChange}
      />
    </Box>
  );
}

export default App;
