import React, { useEffect, useState } from 'react';
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
import { AvailabilityProvider } from './components/AvailabilityProvider.jsx';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { ThemeColorsProvider, useThemeColors } from './theme.jsx';

// Clé utilisée pour mémoriser l'authentification en localStorage
const AUTH_KEY = 'wt-authenticated';
const LOADING_STEPS = [
  'Connexion au serveur',
  'Récupération des arrivées',
  'Récupération des statuts',
  'Préparation de l\'interface'
];

const AvailabilityPeriodPanel = React.lazy(() =>
  import('./components/AvailabilityPeriodPanel.jsx').then(module => ({
    default: module.AvailabilityPeriodPanel
  }))
);
const AvailabilityReservationPanel = React.lazy(() =>
  import('./components/AvailabilityReservationPanel.jsx').then(module => ({
    default: module.AvailabilityReservationPanel
  }))
);
const HarImportPanel = React.lazy(() => import('./components/HarImportPanel.jsx'));
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel.jsx'));

const PanelFallback = ({ label }) => (
  <Box
    sx={{
      py: 4,
      textAlign: 'center',
      color: 'text.secondary',
      fontSize: 16
    }}
  >
    {label || 'Chargement...'}
  </Box>
);

function InnerApp() {
  const { theme } = useThemeColors();
  const [auth, setAuth] = useState(localStorage.getItem(AUTH_KEY) === 'true');
  const [loadingState, setLoadingState] = useState({
    active: true,
    step: 0,
    message: 'Initialisation...'
  });
  const [data, setData] = useState({ reservations: [], erreurs: [] });
  const [statuses, setStatuses] = useState({});
  const USER_KEY = 'wt-user';
  const [selectedUser, setSelectedUser] = useState(
    localStorage.getItem(USER_KEY) || 'Soaz'
  );
  const [panel, setPanel] = useState(0);
  const [loadedPanels, setLoadedPanels] = useState(() => new Set([0]));
  // Chargement des données après authentification
  useEffect(() => {
    if (!auth) return;
    loadData();
  }, [auth]);
  useEffect(() => {
    setLoadedPanels(prev => {
      if (prev.has(panel)) return prev;
      const next = new Set(prev);
      next.add(panel);
      return next;
    });
  }, [panel]);

  const loadData = async () => {
    setLoadingState({
      active: true,
      step: 0,
      message: 'Connexion au serveur...'
    });

    const arrivals = await fetchArrivals();
    setLoadingState({
      active: true,
      step: 1,
      message: 'Arrivées récupérées'
    });

    const stat = await fetchStatuses();
    setLoadingState({
      active: true,
      step: 2,
      message: 'Statuts récupérés'
    });

    setData(arrivals);
    setStatuses(stat);
    setLoadingState({
      active: false,
      step: LOADING_STEPS.length,
      message: 'Interface prête'
    });
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
  if (loadingState.active)
    return (
      <Loader
        steps={LOADING_STEPS}
        activeStep={loadingState.step}
        message={loadingState.message}
      />
    );
  const panelBg = (theme.panelColors && theme.panelColors[panel]) || (theme.panelColors && theme.panelColors[0]) || '#ffffff';
  const shouldRenderPanel = index => panel === index || loadedPanels.has(index);

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
            width: '500%',
            height: '100%',
            touchAction: 'pan-y',
            transform: `translateX(-${panel * 20}%)`,
            transition: 'transform 0.3s'
          }}
        >
          <Box
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
                onRefresh={handleRefresh}
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
          </Box>
          <Box
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              {shouldRenderPanel(1) && (
                <React.Suspense fallback={<PanelFallback label="Chargement des dates..." />}>
                  <AvailabilityPeriodPanel
                    panelBg={panelBg}
                    onReserve={() => setPanel(2)}
                    onBack={() => setPanel(0)}
                  />
                </React.Suspense>
              )}
            </Box>
          </Box>
          <Box
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              {shouldRenderPanel(2) && (
                <React.Suspense fallback={<PanelFallback label="Chargement de la reservation..." />}>
                  <AvailabilityReservationPanel
                    panelBg={panelBg}
                    onBack={() => setPanel(1)}
                  />
                </React.Suspense>
              )}
            </Box>
          </Box>
          <Box
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              {shouldRenderPanel(3) && (
                <React.Suspense fallback={<PanelFallback label="Chargement de l'import..." />}>
                  <HarImportPanel panelBg={panelBg} />
                </React.Suspense>
              )}
            </Box>
          </Box>
          <Box
            sx={{ width: '100%', height: '100%', overflowY: 'auto', pb: 7 }}
          >
            <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', p: 2 }}>
              {shouldRenderPanel(4) && (
                <React.Suspense fallback={<PanelFallback label="Chargement des reglages..." />}>
                  <SettingsPanel panelBg={panelBg} onBack={() => setPanel(3)} />
                </React.Suspense>
              )}
            </Box>
          </Box>
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
              left: `calc((100% / 5) * ${panel} + (100% / 10))`,
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
              <UploadFileIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <IconButton onClick={() => setPanel(4)} sx={{ color: theme.menu?.icon || '#fff' }}>
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
