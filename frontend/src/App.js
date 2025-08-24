import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CalendarBar from './components/CalendarBar';
import ArrivalsList from './components/ArrivalsList';
import Loader from './components/Loader';
import {
  fetchArrivals,
  fetchStatuses,
  updateStatus,
  refreshCalendars
} from './services/api';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction
} from '@mui/material';
import Legend from './components/Legend';
import AvailabilityPanel from './components/AvailabilityPanel';
import ReservationPanel from './components/ReservationPanel';
import SettingsPanel from './components/SettingsPanel';
import TimerIcon from '@mui/icons-material/Timer';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';

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
  const [panel, setPanel] = useState(0);

  // Chargement des données après authentification
  useEffect(() => {
    if (!auth) return;
    loadData().finally(() => setLoading(false));
  }, [auth]);

  const loadData = async () => {
    console.log('Chargement des données...');
    const [arr, stat] = await Promise.all([fetchArrivals(), fetchStatuses()]);
    console.log('Données chargées avec succès');
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
    refreshCalendars()
      .then(() => loadData())
      .finally(() => setRefreshing(false));
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  if (loading) return <Loader />;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', overflow: 'hidden', pb: 7 }}>
      <Box
        sx={{
          display: 'flex',
          width: '400%',
          transform: `translateX(-${panel * 100}%)`,
          transition: 'transform 0.3s'
        }}
      >
        <Box sx={{ width: '100%', flexShrink: 0 }}>
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
        <Box sx={{ width: '100%', flexShrink: 0 }}>
          <AvailabilityPanel bookings={data.reservations} />
        </Box>
        <Box sx={{ width: '100%', flexShrink: 0 }}>
          <ReservationPanel />
        </Box>
        <Box sx={{ width: '100%', flexShrink: 0 }}>
          <SettingsPanel />
        </Box>
      </Box>
      <BottomNavigation
        value={panel}
        onChange={(e, v) => setPanel(v)}
        showLabels
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: '#f48fb1',
          '& .MuiSvgIcon-root': { color: '#fff' }
        }}
      >
        <BottomNavigationAction icon={<TimerIcon />} />
        <BottomNavigationAction icon={<CalendarMonthIcon />} />
        <BottomNavigationAction icon={<EditIcon />} />
        <BottomNavigationAction icon={<SettingsIcon />} />
      </BottomNavigation>
    </Box>
  );
}

export default App;
