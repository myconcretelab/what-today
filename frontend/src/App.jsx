import React, { useState, useEffect, useRef } from 'react';
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
import { Box, IconButton } from '@mui/material';
import Legend from './components/Legend';
import PullToRefresh from './components/PullToRefresh';
import {
  AvailabilityProvider,
  AvailabilityPeriodPanel,
  AvailabilityReservationPanel
} from './components/AvailabilityPanels';
import SettingsPanel from './components/SettingsPanel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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
  const [panel, setPanel] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = e => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchEnd = e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && panel < 3) setPanel(p => Math.min(p + 1, 3));
      if (dx > 0 && panel > 0) setPanel(p => Math.max(p - 1, 0));
    }
  };

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
    const expected = import.meta.env.VITE_PASSWORD || 'secret';
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
    return refreshCalendars().then(() => loadData());
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  if (loading) return <Loader />;

  return (
    <AvailabilityProvider bookings={data.reservations}>
      <Box sx={{ width: '100%', overflow: 'hidden', height: '100vh' }}>
        <Box
          sx={{
            display: 'flex',
            width: '400%',
            height: '100%',
            touchAction: 'pan-y',
            transform: `translateX(-${panel * 25}%)`,
            transition: 'transform 0.3s'
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              p: 2,
              pl: { xs: 1, sm: 2 },
              pb: 7
            }}
          >
            <CalendarBar bookings={data.reservations} errors={data.erreurs} />
            <Legend
              bookings={data.reservations}
              selectedUser={selectedUser}
              onUserChange={user => {
                setSelectedUser(user);
                localStorage.setItem(USER_KEY, user);
              }}
            />
            <ArrivalsList
              bookings={data.reservations}
              errors={data.erreurs}
              statuses={statuses}
              onStatusChange={handleStatusChange}
            />
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <AvailabilityPeriodPanel onReserve={() => setPanel(2)} />
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <AvailabilityReservationPanel onBack={() => setPanel(1)} />
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <SettingsPanel />
          </PullToRefresh>
        </Box>
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            bgcolor: '#f48fb1',
            display: 'flex',
            py: 1
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: `calc((100% / 4) * ${panel} + (100% / 8))`,
              transform: 'translateX(-50%)',
              width:40,
              height: 40,
              border: '2px solid #fff',
              borderRadius: '50%',
              transition: 'left 0.3s',
              pointerEvents: 'none'
            }}
          />
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(0)} sx={{ color: '#fff' }}>
              <AccessTimeIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(1)} sx={{ color: '#fff' }}>
              <CalendarMonthIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(2)} sx={{ color: '#fff' }}>
              <EditIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(3)} sx={{ color: '#fff' }}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </AvailabilityProvider>
  );
}

export default App;
