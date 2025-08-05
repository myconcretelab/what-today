import React from 'react';
import { Box, Typography, Tooltip, Avatar, Card, CardContent } from '@mui/material';
import { Phone } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import airbnbLogo from '../assets/logos/airbnb.svg';
import abritelLogo from '../assets/logos/abritel.svg';
import gdfLogo from '../assets/logos/gitesdefrance.svg';

// Animation légère pour les arrivées du jour
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
`;

// Renvoie le logo correspondant à la source ou null si non disponible
function sourceLogo(type) {
  switch (type) {
    case 'Airbnb':
      return airbnbLogo;
    case 'Abritel':
      return abritelLogo;
    case 'GitesDeFrance':
      return gdfLogo;
    default:
      return null;
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
    <Card sx={{ mb: 2, boxShadow: 3 }}>
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', overflowX: 'auto' }}>
          {days.map(({ date, events }) => (
            <Box key={date.format('YYYY-MM-DD')} sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="caption">
                {date.format('dd DD/MM')}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                {events.slice(0, 3).map((ev, idx) => {
                  const logo = sourceLogo(ev.source);
                  return (
                    <Tooltip
                      key={idx}
                      title={`${ev.giteNom} - ${ev.source}`}
                      arrow
                    >
                      <Avatar
                        src={logo || undefined}
                        sx={{
                          bgcolor: logo ? '#fff' : ev.couleur,
                          width: 24,
                          height: 24,
                          fontSize: 16,
                          boxShadow: 2,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.1)' },
                          animation: dayjs(ev.debut).isSame(dayjs(), 'day') ? `${pulse} 2s infinite` : 'none'
                        }}
                      >
                        {!logo && <Phone fontSize="inherit" />}
                      </Avatar>
                    </Tooltip>
                  );
                })}
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
      </CardContent>
    </Card>
  );
}

export default CalendarBar;
