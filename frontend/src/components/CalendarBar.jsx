import React from 'react';
import { Box, Typography, Tooltip, Avatar, Card, CardContent, useMediaQuery } from '@mui/material';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import {
  sourceColor,
  giteInitial,
  CARD_BG
} from '../utils';



// Animation "shake" courte avec pause ~2s (cycle 2.5s, shake sur 0-20%)
const shake = keyframes`
  0% { transform: translateX(0) rotate(0); }
  5% { transform: translateX(-2px) rotate(-2deg); }
  10% { transform: translateX(2px) rotate(2deg); }
  15% { transform: translateX(-1px) rotate(-1deg); }
  20% { transform: translateX(0) rotate(0); }
  100% { transform: translateX(0) rotate(0); }
`;

/**
 * Barre de calendrier sur 7 jours.
 * Les réservations sont représentées par des pastilles colorées
 * (une couleur par source). Tooltip au survol pour voir le détail.
*/
function CalendarBar({ bookings, errors }) {
  const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm")); // Détection mobile/tablette
  // Construction de la structure { date -> [events] }
  const initialEvents = bookings.flatMap(ev => {
    const debut = dayjs(ev.debut);
    const fin = dayjs(ev.fin);
    if (debut.isSame(fin, 'day')) {
      return [{ ...ev, date: debut, type: 'both' }];
    }
    return [
      { ...ev, date: debut, type: 'arrival' },
      { ...ev, date: fin, type: 'depart' }
    ];
  });

  const mergedMap = new Map();
  initialEvents.forEach(ev => {
    const key = `${ev.giteId}_${ev.date.format('YYYY-MM-DD')}`;
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, ev);
    } else {
      mergedMap.set(key, { ...existing, type: 'both' });
    }
  });
  const events = Array.from(mergedMap.values());

  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = dayjs().startOf('day').add(i, 'day');
    return {
      date,
      events: events.filter(e => e.date.isSame(date, 'day'))
    };
  });

  return (
    <Card sx={{ mb: 3, pb:0, boxShadow: 'none', bgcolor: CARD_BG }}>
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', overflowX: 'auto', width: '100%' }}>
          {days.map(({ date, events }, idx) => (
            <Box
              key={date.format('YYYY-MM-DD')}
              sx={{
                textAlign: 'center',
                flex: 1,
                borderRight: idx !== days.length - 1 ? '1px solid #ccc' : 'none',
                gap: 5
              }}
            >
             <Typography variant="caption">
              {isMobile ? date.format("dd DD") : date.format("dddd DD")}
            </Typography>
            
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.5
                }}
              >
                {events.slice(0, 3).map((ev, idx) => {
                  const color = sourceColor(ev.source);
                  const initial = giteInitial(ev.giteId);
                  const arrow = ev.type === 'arrival' ? '⬆' : ev.type === 'depart' ? '⬇' : '⬍';
                  return (
                    <Tooltip
                      key={idx}
                      title={`${ev.giteNom} - ${ev.source}`}
                      arrow
                    >
                      <Avatar
                        sx={{
                          bgcolor: color,
                          width: 40,
                          height: 40,
                          boxShadow: 0,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.1)' },
                          animation: dayjs(ev.date).isSame(dayjs(), 'day') ? `${shake} 2.5s infinite` : 'none'
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, height: 14 }}>
                            {initial}
                          </Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, mt: '2px' }}>
                            {arrow}
                          </Typography>
                        </Box>
                      </Avatar>
                    </Tooltip>
                  );
                })}
                {events.length > 3 && (
                  <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>
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
