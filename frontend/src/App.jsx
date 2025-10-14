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
import { Box, IconButton } from '@mui/material';
import Legend from './components/Legend';
import PullToRefresh from './components/PullToRefresh';
import { AvailabilityProvider } from './components/AvailabilityProvider.jsx';
import { AvailabilityPeriodPanel } from './components/AvailabilityPeriodPanel.jsx';
import { AvailabilityReservationPanel } from './components/AvailabilityReservationPanel.jsx';
import SettingsPanel from './components/SettingsPanel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import { ThemeColorsProvider, useThemeColors } from './theme.jsx';

// Clé utilisée pour mémoriser l'authentification en localStorage
const AUTH_KEY = 'wt-authenticated';

function InnerApp() {
  const { theme } = useThemeColors();
  const [auth, setAuth] = useState(localStorage.getItem(AUTH_KEY) === 'true');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reservations: [], erreurs: [] });
  const [statuses, setStatuses] = useState({});
  const USER_KEY = 'wt-user';
  const [selectedUser, setSelectedUser] = useState(
    localStorage.getItem(USER_KEY) || 'Soaz'
  );
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
  const panelBg = (theme.panelColors && theme.panelColors[panel]) || (theme.panelColors && theme.panelColors[0]) || '#ffffff';

  return (
    <AvailabilityProvider bookings={data.reservations}>
      <Box
        sx={{
          width: '100%',
          overflow: 'hidden',
          height: '100vh',
          bgcolor: panelBg,
          transition: 'background-color 0.3s ease'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            width: '400%',
            height: '100%',
            touchAction: 'pan-y',
            transform: `translateX(-${panel * 25}%)`,
            transition: 'transform 0.3s'
          }}
        >
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              pb: 7
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 600,
                mx: 'auto',
                p: 2,
                pl: { xs: 1, sm: 2 }
              }}
            >
              <CalendarBar
                bookings={data.reservations}
                errors={data.erreurs}
                statuses={statuses}
                onStatusChange={handleStatusChange}
              />
              <Legend
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
            </Box>
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              <AvailabilityPeriodPanel panelBg={panelBg} onReserve={() => setPanel(2)} onBack={() => setPanel(0)} />
            </Box>
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              <AvailabilityReservationPanel panelBg={panelBg} onBack={() => setPanel(1)} />
            </Box>
          </PullToRefresh>
          <PullToRefresh
            onRefresh={handleRefresh}
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              <SettingsPanel panelBg={panelBg} onBack={() => setPanel(2)} />
            </Box>
          </PullToRefresh>
        </Box>
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            bgcolor: theme.menu?.bg || '#f48fb1',
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
              border: `2px solid ${theme.menu?.indicator || '#fff'}`,
              borderRadius: '50%',
              transition: 'left 0.3s',
              pointerEvents: 'none'
            }}
          />
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(0)} sx={{ color: theme.menu?.icon || '#fff' }}>
              <AccessTimeIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(1)} sx={{ color: theme.menu?.icon || '#fff' }}>
              <CalendarMonthIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(2)} sx={{ color: theme.menu?.icon || '#fff' }}>
              <EditIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(3)} sx={{ color: theme.menu?.icon || '#fff' }}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </AvailabilityProvider>
  );
}

function App() {
  return (
    <ThemeColorsProvider>
      <InnerApp />
    </ThemeColorsProvider>
  );
}

export default App;
