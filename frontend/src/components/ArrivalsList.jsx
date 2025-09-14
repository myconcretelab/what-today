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
  Chip,
  IconButton
} from '@mui/material';
import { Phone as PhoneIcon, Sms as SmsIcon } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SwapVert from '@mui/icons-material/ImportExport';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import {
  sourceColor,
  giteInitial,
} from '../utils';
import { useThemeColors } from '../theme.jsx';
import airbnbLogo from '../assets/logos/airbnb-svgrepo-com.svg';
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
  const { theme: colorTheme } = useThemeColors();
  const [flipping, setFlipping] = React.useState({});

  const flipAnim = keyframes`
    from { transform: rotateY(0deg); }
    to { transform: rotateY(360deg); }
  `;

  const triggerFlip = id => {
    setFlipping(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setFlipping(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 650);
  };

  React.useEffect(() => {
    let timeoutId = null;
    const start = today.format('YYYY-MM-DD');
    // Cover today + 7 days to match UI window
    const end = today.add(7, 'day').format('YYYY-MM-DD');

    const load = async (attempt = 0) => {
      try {
        const data = await fetchComments(start, end);
        setComments(prev => {
          // Update only if changed to avoid useless renders
          const prevStr = JSON.stringify(prev || {});
          const nextStr = JSON.stringify(data || {});
          return prevStr === nextStr ? prev : data;
        });
        // The backend refreshes Google Sheets in background on first call.
        // Trigger one delayed re-fetch to capture fresh data once cache updates.
        if (attempt === 0) {
          timeoutId = setTimeout(() => {
            load(1).catch(() => {});
          }, 1800);
        }
      } catch {
        setComments({});
      }
    };

    if (bookings.length > 0) {
      load();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [bookings]);

  const telHref = phone => `tel:${(phone || '').replace(/[^0-9+]/g, '')}`;
  const smsHref = phone => `sms:${(phone || '').replace(/[^0-9+]/g, '')}`;

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
        <Card key={key} sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontFamily: `'Museo Slab', 'Museo', serif`, fontWeight: 200 }}>
              {key === 'today' ? 'Aujourd\'hui' : 'Demain'}
            </Typography>
            <List>
              {groupes[key].map(ev => {
                const color = sourceColor(ev.source);
                const initial = giteInitial(ev.giteId);
              const status = statuses[ev.id]?.done;
              const user = statuses[ev.id]?.user;
              // Event type color to use as left border
              const typeColor = colorTheme.events?.[ev.type] || colorTheme.events?.both || '#000';
              // Ticket background now uses theme ticketBg (or grey when done)
              const itemBg = status ? theme.palette.grey[200] : (colorTheme.ticketBg || '#ffffff');
              const textColor = status
                ? theme.palette.text.primary
                : theme.palette.getContrastText(itemBg);
              // Use the displayed event date for comment lookup
              const commentKey = `${ev.giteId}_${ev.date.format('YYYY-MM-DD')}`;
              const entry = comments[commentKey];
              const rawComment =
                typeof entry === 'string' ? entry : (entry?.comment || '');
              // Business rule: no comment for departures; for "both" use arrival (current date)
              const displayedComment = ev.type === 'depart' ? '' : rawComment;
              const phone = typeof entry === 'object' && entry ? entry.phone : '';
              return (
                <ListItem
                  key={ev.id}
                  sx={{
                    bgcolor: itemBg,
                    color: textColor,
                    mb: 1,
                    px: 2,
                    py: 1,
                    border: 'none',
                    borderLeft: `8px solid ${typeColor}`,
                    transition: 'background-color 0.3s, border-color 0.3s'
                  }}
                  >
                  <ListItemAvatar>
                      <Avatar
                        onClick={() => { onStatusChange(ev.id, !status); triggerFlip(ev.id); }}
                        sx={{
                          bgcolor: color,
                          width: 40,
                          height: 40,
                          border: 'none',
                          boxShadow: 0,
                          transition: 'transform 0.2s',
                          cursor: 'pointer',
                          '&:hover': { transform: 'scale(1.05)' },
                          animation: flipping[ev.id] ? `${flipAnim} 0.6s ease-in-out` : 'none'
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, height: 14 }}>
                            {initial}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: '2px', height: 14 }}>
                            {(ev.type === 'arrival') && <ArrowUpwardIcon sx={{ fontSize: 16, lineHeight: 1 }} />}
                            {(ev.type === 'depart') && <ArrowDownwardIcon sx={{ fontSize: 16, lineHeight: 1 }} />}
                            {(ev.type === 'both') && <SwapVert sx={{ fontSize: 16, lineHeight: 1 }} />}
                          </Box>
                        </Box>
                      </Avatar>
                  </ListItemAvatar>
                    <ListItemText
                      primary={ev.giteNom}
                      secondary={
                        displayedComment ? (
                          <Typography
                            component="span"
                            variant="caption"
                            display="block"
                            sx={{ color: 'inherit', fontStyle: 'italic' }}
                          >
                            {displayedComment}
                          </Typography>
                        ) : null
                      }
                      primaryTypographyProps={{ sx: { color: 'inherit', fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: 'inherit' } }}
                      sx={{ mr: 1 }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }} />
                      {status && user && (
                        <Chip label={user} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {ev.airbnbUrl && (
                          <IconButton
                            component="a"
                            href={ev.airbnbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            sx={{ color: textColor }}
                            aria-label="Ouvrir la réservation Airbnb"
                          >
                            <img src={airbnbLogo} alt="Airbnb" style={{ width: 18, height: 18 }} />
                          </IconButton>
                        )}
                        {phone && (
                          <IconButton
                            component="a"
                            href={telHref(phone)}
                            size="small"
                            sx={{ color: textColor }}
                            aria-label="Appeler"
                          >
                            <PhoneIcon fontSize="small" />
                          </IconButton>
                        )}
                        {phone && (
                          <IconButton
                            component="a"
                            href={smsHref(phone)}
                            size="small"
                            sx={{ color: textColor }}
                            aria-label="Envoyer un SMS"
                          >
                            <SmsIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
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

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontFamily: `'Museo Slab', 'Museo', serif`, fontWeight: 200 }}>Prochains jours</Typography>
          <List>
            {groupes.next.map(ev => {
              const color = sourceColor(ev.source);
              const initial = giteInitial(ev.giteId);
              const typeColor = colorTheme.events?.[ev.type] || colorTheme.events?.both || '#000';
              const status = statuses[ev.id]?.done;
              const user = statuses[ev.id]?.user;
              const itemBg = status ? theme.palette.grey[200] : (colorTheme.ticketBg || '#ffffff');
              const textColor = status
                ? theme.palette.text.primary
                : theme.palette.getContrastText(itemBg);
              
              // Use the displayed event date for comment lookup
              const commentKey = `${ev.giteId}_${ev.date.format('YYYY-MM-DD')}`;
              const entry = comments[commentKey];
              const rawComment =
                typeof entry === 'string' ? entry : (entry?.comment || '');
              // Business rule: no comment for departures; for "both" use arrival (current date)
              const displayedComment = ev.type === 'depart' ? '' : rawComment;
              const phone = typeof entry === 'object' && entry ? entry.phone : '';
              return (
                <ListItem
                  key={ev.id}
                  sx={{
                    bgcolor: itemBg,
                    color: textColor,
                    mb: 1,
                    px: 2,
                    py: 1,
                    border: 'none',
                    borderLeft: `10px solid ${typeColor}`,
                    transition: 'background-color 0.3s, border-color 0.3s'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: color,
                        width: 40,
                        height: 40,
                        border: 'none',
                        boxShadow: 0,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'scale(1.05)' }
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, height: 14 }}>
                          {initial}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: '2px', height: 14 }}>
                          {(ev.type === 'arrival') && <ArrowUpwardIcon sx={{ fontSize: 16, lineHeight: 1 }} />}
                          {(ev.type === 'depart') && <ArrowDownwardIcon sx={{ fontSize: 16, lineHeight: 1 }} />}
                          {(ev.type === 'both') && <SwapVert sx={{ fontSize: 16, lineHeight: 1 }} />}
                        </Box>
                      </Box>
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={format(ev.date)}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="caption"
                          display="block"
                          sx={{
                            color: 'inherit',
                            fontFamily: `'Museo Slab', 'Museo', serif`,
                            fontWeight: 500,
                            fontSize: '0.9rem'
                          }}
                        >
                          {ev.giteNom}
                        </Typography>
                        {displayedComment && (
                          <Typography
                            component="span"
                            variant="caption"
                            display="block"
                            sx={{
                              color: 'inherit',
                              fontFamily: `'Museo Slab', 'Museo', serif`,
                              fontWeight: 300,
                              fontStyle: 'italic',
                              mt: 0.5
                            }}
                          >
                            {displayedComment}
                          </Typography>
                        )}
                      </>
                    }
                    primaryTypographyProps={{ sx: { color: 'grey', fontWeight: 500 } }}
                    secondaryTypographyProps={{ sx: { color: 'inherit' } }}
                    sx={{ mr: 1 }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    {/* Switch removed for "Prochains jours" */}
                    {status && user && (
                      <Chip label={user} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {ev.airbnbUrl && (
                        <IconButton
                          component="a"
                          href={ev.airbnbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          sx={{ color: textColor }}
                          aria-label="Ouvrir la réservation Airbnb"
                        >
                          <img src={airbnbLogo} alt="Airbnb" style={{ width: 18, height: 18 }} />
                        </IconButton>
                      )}
                      {phone && (
                        <IconButton
                          component="a"
                          href={telHref(phone)}
                          size="small"
                          sx={{ color: textColor }}
                          aria-label="Appeler"
                        >
                          <PhoneIcon fontSize="small" />
                        </IconButton>
                      )}
                      {phone && (
                        <IconButton
                          component="a"
                          href={smsHref(phone)}
                          size="small"
                          sx={{ color: textColor }}
                          aria-label="Envoyer un SMS"
                        >
                          <SmsIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
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
