import React from 'react';
import { Box, Typography, Avatar, Card, CardContent, useMediaQuery, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SwapVert from '@mui/icons-material/ImportExport';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import { sourceColor, giteInitial } from '../utils';
import { useThemeColors } from '../theme.jsx';



// Animation "shake" courte avec pause ~2s (cycle 2.5s, shake sur 0-20%)
const shake = keyframes`
  0% { transform: translateX(0) rotate(0); }
  5% { transform: translateX(-2px) rotate(-2deg); }
  10% { transform: translateX(2px) rotate(2deg); }
  15% { transform: translateX(-1px) rotate(-1deg); }
  20% { transform: translateX(0) rotate(0); }
  100% { transform: translateX(0) rotate(0); }
`;

// Animation de flip horizontal complet
const flipAnim = keyframes`
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
`;

/**
 * Barre de calendrier sur 7 jours.
 * Les réservations sont représentées par des pastilles colorées
 * (une couleur par source). Tooltip au survol pour voir le détail.
*/
function CalendarBar({ bookings, errors, statuses = {}, onStatusChange = () => {} }) {
  const { theme: colorTheme } = useThemeColors();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm")); // Détection mobile/tablette
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');
  const [flipping, setFlipping] = React.useState({});
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
    <Card sx={{ mb: 3, pb:0, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
                  const ArrowIcon = ev.type === 'arrival'
                    ? ArrowUpwardIcon
                    : ev.type === 'depart'
                      ? ArrowDownwardIcon
                      : SwapVert;
                  const dateStr = ev.date.format('YYYY-MM-DD');
                  const eventId = ev.type === 'both'
                    ? `${ev.giteId}_${dateStr}_both`
                    : `${ev.giteId}_${dateStr}_${ev.type}_${ev.source}`;
                  const isDone = Boolean(statuses[eventId]?.done);
                  const canToggle = ev.date.isSame(today, 'day') || ev.date.isSame(tomorrow, 'day');
                  const handleClick = () => {
                    if (!canToggle) return;
                    onStatusChange(eventId, !isDone);
                    // trigger flip animation per id
                    setFlipping(prev => ({ ...prev, [eventId]: true }));
                    setTimeout(() => {
                      setFlipping(prev => {
                        const next = { ...prev };
                        delete next[eventId];
                        return next;
                      });
                    }, 650);
                  };
                  return (
                    <Avatar
                      key={idx}
                      onClick={handleClick}
                      sx={{
                        bgcolor: color,
                        width: 40,
                        height: 40,
                        border: 'none',
                        boxShadow: 0,
                        transition: 'transform 0.2s',
                        cursor: canToggle ? 'pointer' : 'default',
                        '&:hover': { transform: canToggle ? 'scale(1.1)' : 'none' },
                        animation: flipping[eventId]
                          ? `${flipAnim} 0.6s ease-in-out`
                          : (dayjs(ev.date).isSame(dayjs(), 'day') ? `${shake} 2.5s infinite` : 'none'),
                        opacity: isDone ? 0.6 : 1
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, height: 14 }}>
                          {initial}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: '2px', height: 14 }}>
                          <ArrowIcon sx={{ fontSize: 16, lineHeight: 1 }} />
                        </Box>
                      </Box>
                    </Avatar>
                  );
                })}
                {events.length > 3 && (
                  <Avatar sx={{ width: 30, height: 30, fontSize: 12, border: 'none' }}>
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
