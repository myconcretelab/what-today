import React from 'react';
import { Box, Typography, Tooltip, Avatar, Card, CardContent } from '@mui/material';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import {
  sourceColor,
  giteInitial,
  eventColor,
  borderWidth,
  borderColor
} from '../utils';

// Animation légère pour les arrivées du jour
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
`;

/**
 * Barre de calendrier sur 7 jours.
 * Les réservations sont représentées par des pastilles colorées
 * (une couleur par source). Tooltip au survol pour voir le détail.
*/
function CalendarBar({ bookings, errors }) {
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
                  const color = sourceColor(ev.source);
                  const initial = giteInitial(ev.giteId);
                  const borderClr = borderColor(ev.type);
                  const bw = borderWidth(ev.type);
                  return (
                    <Tooltip
                      key={idx}
                      title={`${ev.giteNom} - ${ev.source}`}
                      arrow
                    >
                      <Avatar
                        sx={{
                          bgcolor: color,
                          width: 24,
                          height: 24,
                          fontSize: 16,
                          boxShadow: 0,
                          border: `${bw}px solid`,
                          borderColor: borderClr,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.1)' },
                          animation: dayjs(ev.date).isSame(dayjs(), 'day') ? `${pulse} 2s infinite` : 'none'
                        }}
                      >
                        {initial}
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
