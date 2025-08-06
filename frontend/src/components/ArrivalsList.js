import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Card,
  CardContent,
  Switch,
  Chip
} from '@mui/material';
import {
  DoorFront,
  DoorBack,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Sync as SyncIcon,
  Luggage
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { sourceColor, giteInitial } from '../utils';

/**
 * Liste des arrivées à venir (aujourd'hui + 6 jours).
 * Aujourd'hui et demain sont mis en avant.
 */
function ArrivalsList({ bookings, errors, statuses, onStatusChange }) {
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');

  const events = bookings.flatMap(ev => {
    const debut = dayjs(ev.debut);
    const fin = dayjs(ev.fin);
    if (debut.isSame(fin, 'day')) {
      return [
        {
          ...ev,
          date: debut,
          type: 'both',
          id: `${ev.giteId}_${debut.format('YYYY-MM-DD')}_both_${ev.source}`
        }
      ];
    }
    return [
      {
        ...ev,
        date: debut,
        type: 'arrival',
        id: `${ev.giteId}_${debut.format('YYYY-MM-DD')}_arrival_${ev.source}`
      },
      {
        ...ev,
        date: fin,
        type: 'depart',
        id: `${ev.giteId}_${fin.format('YYYY-MM-DD')}_depart_${ev.source}`
      }
    ];
  });

  const format = d => d.format('dddd DD/MM');

  const groupes = {
    today: events.filter(b => b.date.isSame(today, 'day')),
    tomorrow: events.filter(b => b.date.isSame(tomorrow, 'day')),
    next: events.filter(b => b.date.isAfter(tomorrow, 'day'))
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
              {groupes[key].map(ev => {
                const color = sourceColor(ev.source);
                const initial = giteInitial(ev.giteId);
                const status = statuses[ev.id]?.done;
                const user = statuses[ev.id]?.user;
                return (
                  <ListItem
                    key={ev.id}
                    sx={{
                      bgcolor: status ? 'success.light' : 'error.light',
                      mb: 1,
                      border: '1px solid',
                      borderColor: status ? 'success.main' : 'error.main',
                      transition: 'background-color 0.3s, border-color 0.3s'
                    }}
                  >
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
                      secondary={format(ev.date)}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {ev.type === 'arrival' && (
                        <>
                          <DoorFront fontSize="small" />
                          <Luggage fontSize="small" />
                          <LoginIcon fontSize="small" />
                        </>
                      )}
                      {ev.type === 'depart' && (
                        <>
                          <DoorBack fontSize="small" />
                          <Luggage fontSize="small" />
                          <LogoutIcon fontSize="small" />
                        </>
                      )}
                      {ev.type === 'both' && (
                        <>
                          <SyncIcon fontSize="small" />
                          <Luggage fontSize="small" />
                        </>
                      )}
                      <Switch
                        size="small"
                        checked={Boolean(status)}
                        onChange={() => onStatusChange(ev.id, !status)}
                      />
                      {status && user && (
                        <Chip
                          avatar={<Avatar>{user[0]}</Avatar>}
                          label={user}
                          size="small"
                        />
                      )}
                    </Box>
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
            {groupes.next.map(ev => {
              const color = sourceColor(ev.source);
              const initial = giteInitial(ev.giteId);
              return (
                <ListItem key={ev.id}>
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
                    primary={`${format(ev.date)} - ${ev.giteNom}`}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {ev.type === 'arrival' && (
                      <>
                        <DoorFront fontSize="small" />
                        <Luggage fontSize="small" />
                        <LoginIcon fontSize="small" />
                      </>
                    )}
                    {ev.type === 'depart' && (
                      <>
                        <DoorBack fontSize="small" />
                        <Luggage fontSize="small" />
                        <LogoutIcon fontSize="small" />
                      </>
                    )}
                    {ev.type === 'both' && (
                      <>
                        <SyncIcon fontSize="small" />
                        <Luggage fontSize="small" />
                      </>
                    )}
                  </Box>
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
