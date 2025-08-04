import React from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText } from '@mui/material';
import dayjs from 'dayjs';
import { Home, BeachAccess, Nature, Phone } from '@mui/icons-material';

// Même mapping d'icônes que dans CalendarBar
function sourceIcon(type) {
  switch (type) {
    case 'Airbnb':
      return <Home />;
    case 'Abritel':
      return <BeachAccess />;
    case 'GitesDeFrance':
      return <Nature />;
    case 'Direct':
    default:
      return <Phone />;
  }
}

/**
 * Liste des arrivées à venir (aujourd'hui + 6 jours).
 * Aujourd'hui et demain sont mis en avant.
 */
function ArrivalsList({ bookings, errors }) {
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');

  const format = d => d.format('dddd DD/MM');

  const groupes = {
    today: bookings.filter(b => dayjs(b.debut).isSame(today, 'day')),
    tomorrow: bookings.filter(b => dayjs(b.debut).isSame(tomorrow, 'day')),
    next: bookings.filter(b =>
      dayjs(b.debut).isAfter(tomorrow, 'day')
    )
  };

  return (
    <Box sx={{ p: 2 }}>
      {['today', 'tomorrow'].map(key => (
        <Box key={key} sx={{ mb: 2 }}>
          <Typography variant="h6">
            {key === 'today' ? 'Aujourd\'hui' : 'Demain'}
          </Typography>
          <List>
            {groupes[key].map((ev, idx) => (
              <ListItem key={idx} sx={{ bgcolor: ev.couleur + '33', mb: 1 }}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: ev.couleur }}>{sourceIcon(ev.source)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={ev.giteNom}
                  secondary={format(dayjs(ev.debut))}
                />
              </ListItem>
            ))}
            {groupes[key].length === 0 && (
              <Typography variant="body2" sx={{ ml: 2 }}>
                Aucune arrivée
              </Typography>
            )}
          </List>
        </Box>
      ))}

      <Typography variant="h6">Prochains jours</Typography>
      <List>
        {groupes.next.map((ev, idx) => (
          <ListItem key={idx}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: ev.couleur }}>{sourceIcon(ev.source)}</Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={`${format(dayjs(ev.debut))} - ${ev.giteNom}`}
            />
          </ListItem>
        ))}
        {groupes.next.length === 0 && (
          <Typography variant="body2" sx={{ ml: 2 }}>
            Rien à signaler
          </Typography>
        )}
      </List>

      {errors.length > 0 && (
        <Typography color="error" sx={{ mt: 2 }}>
          ? Données manquantes pour : {errors.join(', ')}
        </Typography>
      )}
    </Box>
  );
}

export default ArrivalsList;
