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
  statusBorderColor,
  CARD_BG
} from '../utils';
import { fetchComments } from '../services/api';

/**
 * Liste des arrivées à venir (aujourd'hui + 6 jours).
 * Aujourd'hui et demain sont mis en avant.
 */
function ArrivalsList({ bookings, errors, statuses, onStatusChange }) {
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');
  const theme = useTheme();
  const [comments, setComments] = React.useState({});

  React.useEffect(() => {
    const load = async () => {
      const start = today.format('YYYY-MM-DD');
      const end = today.add(6, 'day').format('YYYY-MM-DD');
      try {
        const data = await fetchComments(start, end);
        console.log('Fetched comments:', data);
        setComments(data);
      } catch {
        setComments({});
      }
    };
    if (bookings.length > 0) {
      load();
    }
  }, [bookings]);

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

  // Merge arrival and departure only when both exist for the same gite/day
  const grouped = new Map();
  const standalone = [];
  initialEvents.forEach(ev => {
    if (ev.type === 'both') {
      standalone.push(ev);
      return;
    }
    const key = `${ev.giteId}_${ev.date.format('YYYY-MM-DD')}`;
    const group = grouped.get(key) || { arrivals: [], departs: [] };
    if (ev.type === 'arrival') {
      group.arrivals.push(ev);
    } else if (ev.type === 'depart') {
      group.departs.push(ev);
    }
    grouped.set(key, group);
  });
  const events = [
    ...standalone,
    ...Array.from(grouped.entries()).flatMap(([key, g]) => {
      if (g.arrivals.length > 0 && g.departs.length > 0) {
        const a = g.arrivals[0];
        const d = g.departs[0];
        // Avoid merging arrival and departure of the same reservation (if UID available)
        if (a.uid && d.uid && a.uid === d.uid) {
          return [a, d];
        }
        // true turnover: one booking ends and another begins
        return [{ ...a, type: 'both', id: `${key}_both` }];
      }
      return [...g.arrivals, ...g.departs];
    })
  ].sort((a, b) => a.date - b.date);

  const format = d => d.format('dddd DD/MM');

  const groupes = {
    today: events.filter(b => b.date.isSame(today, 'day')),
    tomorrow: events.filter(b => b.date.isSame(tomorrow, 'day')),
    next: events.filter(
      b => b.date.isAfter(tomorrow, 'day') && b.date.diff(today, 'day') <= 7
    )
  };

  return (
    <Box sx={{ p: 0 }}>
      {['today', 'tomorrow'].map(key => (
        <Card key={key} sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
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
              const itemBg = status ? theme.palette.grey[200] : bg;
              const textColor = status
                ? theme.palette.text.primary
                : theme.palette.getContrastText(itemBg);

              const bw = borderWidth(ev.type);
              const commentKey = `${ev.giteId}_${ev.debut}`;
              const comment = comments[commentKey];
              return (
                <ListItem
                  key={ev.id}
                  sx={{
                    bgcolor: itemBg,
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
                      secondary={
                        <>
                          {format(ev.date)}
                          <Typography component="span" variant="caption" display="block">
                            {comment || ''}
                          </Typography>
                        </>
                      }
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

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
        <CardContent>
          <Typography variant="h6">Prochains jours</Typography>
          <List>
            {groupes.next.map(ev => {
              const color = sourceColor(ev.source);
              const initial = giteInitial(ev.giteId);
              const bg = eventColor(ev.type);
              const status = statuses[ev.id]?.done;
              const user = statuses[ev.id]?.user;
              const itemBg = status ? theme.palette.grey[200] : bg;
              const textColor = status
                ? theme.palette.text.primary
                : theme.palette.getContrastText(itemBg);
              const bw = borderWidth(ev.type);
              const commentKey = `${ev.giteId}_${ev.debut}`;
              const comment = comments[commentKey];
              return (
                <ListItem
                  key={ev.id}
                  sx={{
                    bgcolor: itemBg,
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
                    secondary={
                      <Typography component="span" variant="caption">
                        {comment || 'pas de commentaires'}
                      </Typography>
                    }
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
