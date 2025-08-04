import React from 'react';
import { Box, Typography, Tooltip, Avatar } from '@mui/material';
import { Home, BeachAccess, Nature, Phone } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';

// Animation légère pour les arrivées du jour
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
`;

// Renvoie l'icône correspondant à la source de réservation
function sourceIcon(type) {
  switch (type) {
    case 'Airbnb':
      return <Home fontSize="inherit" />;
    case 'Abritel':
      return <BeachAccess fontSize="inherit" />;
    case 'GitesDeFrance':
      return <Nature fontSize="inherit" />;
    case 'Direct':
    default:
      return <Phone fontSize="inherit" />;
  }
}

/**
 * Barre de calendrier sur 7 jours.
 * Les réservations sont représentées par des pastilles colorées
 * (une couleur par gîte). Tooltip au survol pour voir le détail.
 */
function CalendarBar({ bookings, errors }) {
  // Construction de la structure { date -> [events] }
  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = dayjs().startOf('day').add(i, 'day');
    return {
      date,
      events: bookings.filter(b => dayjs(b.debut).isSame(date, 'day'))
    };
  });

  return (
    <Box sx={{ display: 'flex', overflowX: 'auto', p: 1 }}>
      {days.map(({ date, events }) => (
        <Box key={date.format('YYYY-MM-DD')} sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="caption">
            {date.format('dd DD/MM')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
            {events.slice(0, 3).map((ev, idx) => (
              <Tooltip
                key={idx}
                title={`${ev.giteNom} - ${ev.source}`}
                arrow
              >
                <Avatar
                  sx={{
                    bgcolor: ev.couleur,
                    width: 24,
                    height: 24,
                    fontSize: 16,
                    animation: dayjs(ev.debut).isSame(dayjs(), 'day') ? `${pulse} 2s infinite` : 'none'
                  }}
                >
                  {sourceIcon(ev.source)}
                </Avatar>
              </Tooltip>
            ))}
            {events.length > 3 && (
              <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                +{events.length - 3}
              </Avatar>
            )}
          </Box>
        </Box>
      ))}
      {errors.length > 0 && (
        <Box sx={{ ml: 2 }}>
          <Tooltip title={`Sources indisponibles: ${errors.join(', ')}`}>
            <Typography variant="h6">?</Typography>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default CalendarBar;
