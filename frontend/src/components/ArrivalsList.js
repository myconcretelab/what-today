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
import { Login as LoginIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import {
  sourceColor,
  giteInitial,
  eventColor,
  borderWidth,
  statusBorderColor
} from '../utils';

/**
 * Liste des arrivées à venir (aujourd'hui + 6 jours).
 * Aujourd'hui et demain sont mis en avant.
 */
function ArrivalsList({ bookings, errors, statuses, onStatusChange }) {
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');
  const theme = useTheme();

  const initialEvents = bookings.flatMap(ev => {
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

  // Fusionner entrée et sortie le même jour pour un même gîte
  const mergedMap = new Map();
  initialEvents.forEach(ev => {
    const key = `${ev.giteId}_${ev.date.format('YYYY-MM-DD')}`;
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, ev);
    } else {
      mergedMap.set(key, {
        ...existing,
        type: 'both',
        id: `${key}_both`
      });
    }
  });
  const events = Array.from(mergedMap.values()).sort((a, b) => a.date - b.date);

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
                const bg = eventColor(ev.type);
                const textColor = theme.palette.getContrastText(bg);

                const bw = borderWidth(ev.type);
                const borderWidth = ev.type === 'arrival' ? 3 : 3;
                return (
                  <ListItem
                    key={ev.id}
                    sx={{
                      bgcolor: bg,
                      color: textColor,
                      mb: 1,
                      border: `${bw}px solid`,
                      borderColor: statusBorderColor(status),
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
                      primaryTypographyProps={{ sx: { color: 'inherit' } }}
                      secondaryTypographyProps={{ sx: { color: 'inherit' } }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {ev.type === 'arrival' && <LoginIcon fontSize="small" />}
                      {ev.type === 'depart' && <LogoutIcon fontSize="small" />}
                      {ev.type === 'both' && (
                        <>
                          <LogoutIcon fontSize="small" />
                          <LoginIcon fontSize="small" />
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
              const bg = eventColor(ev.type);
              const textColor = theme.palette.getContrastText(bg);
              const status = statuses[ev.id]?.done;
              const user = statuses[ev.id]?.user;
              const bw = borderWidth(ev.type);
              return (
                <ListItem
                  key={ev.id}
                  sx={{
                    bgcolor: bg,
                    color: textColor,
                    mb: 1,
                    border: `${bw}px solid`,
                    borderColor: statusBorderColor(status),
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
                    primary={`${format(ev.date)} - ${ev.giteNom}`}
                    primaryTypographyProps={{ sx: { color: 'inherit' } }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {ev.type === 'arrival' && <LoginIcon fontSize="small" />}
                    {ev.type === 'depart' && <LogoutIcon fontSize="small" />}
                    {ev.type === 'both' && (
                      <>
                        <LogoutIcon fontSize="small" />
                        <LoginIcon fontSize="small" />
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
