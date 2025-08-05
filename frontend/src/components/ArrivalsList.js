import React from 'react';
import { Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText, Card, CardContent } from '@mui/material';
import dayjs from 'dayjs';
import { sourceColor, giteInitial } from '../utils';

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
        <Card key={key} sx={{ mb: 2, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h6">
              {key === 'today' ? 'Aujourd\'hui' : 'Demain'}
            </Typography>
            <List>
              {groupes[key].map((ev, idx) => {
                const color = sourceColor(ev.source);
                const initial = giteInitial(ev.giteId);
                return (
                  <ListItem key={idx} sx={{ bgcolor: color + '33', mb: 1 }}>
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: color,
                          boxShadow: 1,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}
                      >
                        {initial}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={ev.giteNom}
                      secondary={format(dayjs(ev.debut))}
                    />
                  </ListItem>
                );
              })}
              {groupes[key].length === 0 && (
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Aucune arrivée
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      ))}

      <Card sx={{ mb: 2, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h6">Prochains jours</Typography>
          <List>
            {groupes.next.map((ev, idx) => {
              const color = sourceColor(ev.source);
              const initial = giteInitial(ev.giteId);
              return (
                <ListItem key={idx}>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: color,
                        boxShadow: 1,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'scale(1.05)' }
                      }}
                    >
                      {initial}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${format(dayjs(ev.debut))} - ${ev.giteNom}`}
                  />
                </ListItem>
              );
            })}
            {groupes.next.length === 0 && (
              <Typography variant="body2" sx={{ ml: 2 }}>
                Rien à signaler
              </Typography>
            )}
          </List>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Typography color="error" sx={{ mt: 2 }}>
          ? Données manquantes pour : {errors.join(', ')}
        </Typography>
      )}
    </Box>
  );
}

export default ArrivalsList;
