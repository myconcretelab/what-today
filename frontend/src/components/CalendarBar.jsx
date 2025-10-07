import React from 'react';
import { Box, Typography, Avatar, Card, CardContent, useMediaQuery, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SwapVert from '@mui/icons-material/ImportExport';
import { keyframes } from '@mui/system';
import dayjs from 'dayjs';
import { sourceColor, giteInitial, GITES } from '../utils';
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

const GITE_ROW_VERTICAL_PADDING = 0.5; // spacing between gîtes rows (theme unit)
const BOOKING_LINE_THICKNESS = 2; // px thickness for booking line
const BOOKING_LINE_COLOR = 'dynamic'; // 'dynamic' or HEX string override (e.g. '#2196f3')
const BOOKING_LINE_ALPHA = 0.5; // opacity applied to booking period bars
const BOOKING_LINE_DASH_SIZE = 5; // px dash length (0 for solid line)
const BOOKING_LINE_AVATAR_GAP = 10; // px gap to keep between booking bars and avatar edge
const AVATAR_SIZE = 40; // px avatar diameter, used as row baseline height
const BOOKING_LINE_AVATAR_CLEARANCE = (AVATAR_SIZE / 2) + BOOKING_LINE_AVATAR_GAP; // px clearance to avoid overlapping avatars

const computeRowMinHeight = theme => {
  if (GITE_ROW_VERTICAL_PADDING === 0) {
    return `${AVATAR_SIZE}px`;
  }
  const padding = theme.spacing(GITE_ROW_VERTICAL_PADDING * 2);
  return `calc(${padding} + ${AVATAR_SIZE}px)`;
};

/**
 * Barre de calendrier sur 7 jours.
 * Les réservations sont représentées par des pastilles colorées
 * (une couleur par source). Tooltip au survol pour voir le détail.
*/
function CalendarBar({
  bookings,
  errors,
  statuses = {},
  onStatusChange = () => {},
  showPeriod = true
}) {
  const { theme: colorTheme } = useThemeColors();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm")); // Détection mobile/tablette
  const today = dayjs().startOf('day');
  const tomorrow = today.add(1, 'day');
  const [flipping, setFlipping] = React.useState({});
  const buildEventId = event => {
    const dateStr = event.date.format('YYYY-MM-DD');
    if (event.type === 'both') {
      return `${event.giteId}_${dateStr}_both`;
    }
    return `${event.giteId}_${dateStr}_${event.type}_${event.source}`;
  };
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

  const dayCount = 7;
  const days = Array.from({ length: dayCount }, (_, i) => today.add(i, 'day'));
  const lastIndex = dayCount - 1;
  const baseUnit = 100 / dayCount;

  const rangeEnd = today.add(lastIndex, 'day');
  const todayValue = today.valueOf();
  const rangeEndValue = rangeEnd.valueOf();

  const giteNameMap = React.useMemo(() => {
    const map = new Map(GITES.map(g => [g.id, g.name]));
    bookings.forEach(b => {
      if (!map.has(b.giteId)) {
        map.set(b.giteId, b.giteName || b.gite || b.giteId);
      }
    });
    return map;
  }, [bookings]);

  const giteCatalog = React.useMemo(() => {
    return Array.from(giteNameMap.entries()).map(([id, name]) => ({ id, name }));
  }, [giteNameMap]);

  const eventsByGite = React.useMemo(() => {
    const map = new Map();
    events.forEach(ev => {
      const list = map.get(ev.giteId) || [];
      list.push(ev);
      map.set(ev.giteId, list);
    });
    map.forEach(list => list.sort((a, b) => a.date.valueOf() - b.date.valueOf()));
    return map;
  }, [events]);

  const bookingsByGite = React.useMemo(() => {
    const map = new Map();
    bookings.forEach(item => {
      const start = dayjs(item.debut).startOf('day');
      const end = dayjs(item.fin).startOf('day');
      const list = map.get(item.giteId) || [];
      list.push({ ...item, start, end });
      map.set(item.giteId, list);
    });
    map.forEach(list => list.sort((a, b) => a.start.valueOf() - b.start.valueOf()));
    return map;
  }, [bookings]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map();
    events.forEach(ev => {
      if (ev.date.isBefore(today, 'day') || ev.date.isAfter(rangeEnd, 'day')) {
        return;
      }
      const key = ev.date.format('YYYY-MM-DD');
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    });
    map.forEach(list => {
      list.sort((a, b) => {
        const typeOrder = { arrival: 0, both: 1, depart: 2 };
        if (a.type !== b.type) {
          return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
        }
        const nameA = giteNameMap.get(a.giteId) || a.giteId;
        const nameB = giteNameMap.get(b.giteId) || b.giteId;
        return nameA.localeCompare(nameB);
      });
    });
    return map;
  }, [events, todayValue, rangeEndValue, giteNameMap]);

  const renderAvatar = (event, eventId) => {
    const color = sourceColor(event.source);
    const ArrowIcon = event.type === 'arrival'
      ? ArrowUpwardIcon
      : event.type === 'depart'
        ? ArrowDownwardIcon
        : SwapVert;
    const isDone = Boolean(statuses[eventId]?.done);
    const isToday = event.date.isSame(today, 'day');
    const canToggle = isToday || event.date.isSame(tomorrow, 'day');
    const handleClick = () => {
      if (!canToggle) {
        return;
      }
      onStatusChange(eventId, !isDone);
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
        onClick={handleClick}
        sx={{
          bgcolor: color,
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          border: 'none',
          boxShadow: 0,
          transition: 'transform 0.2s',
          cursor: canToggle ? 'pointer' : 'default',
          '&:hover': { transform: canToggle ? 'scale(1.08)' : 'none' },
          animation: flipping[eventId]
            ? `${flipAnim} 0.6s ease-in-out`
            : (isToday ? `${shake} 2.5s infinite` : 'none'),
          opacity: isDone ? 0.6 : 1,
          zIndex: 2
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, height: 14 }}>
            {giteInitial(event.giteId)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: '2px', height: 14 }}>
            <ArrowIcon sx={{ fontSize: 16, lineHeight: 1 }} />
          </Box>
        </Box>
      </Avatar>
    );
  };

  const renderDayHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', pb: 1 }}>
      {days.map((date, idx) => (
        <Box
          key={date.format('YYYY-MM-DD')}
          sx={{
            flex: 1,
            textAlign: 'center',
            borderRight: idx !== days.length - 1 ? '1px solid #e0e0e0' : 'none'
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {isMobile ? date.format('dd DD') : date.format('dddd DD')}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  const renderPeriodContent = () => (
    <>
      {renderDayHeader()}
      {giteCatalog.map(({ id, name }, giteIdx) => {
        const giteEvents = eventsByGite.get(id) || [];
        const giteBookings = bookingsByGite.get(id) || [];
        return (
          <Box
            key={id}
            sx={{
              position: 'relative',
              minHeight: computeRowMinHeight,
              py: GITE_ROW_VERTICAL_PADDING,
              borderTop: giteIdx === 0 ? '1px solid #ededed' : '1px solid #f0f0f0'
            }}
          >
            <Tooltip title={name} placement="left">
              <Box sx={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                {giteBookings
                  .map((booking, segIdx) => {
                    if (booking.end.isBefore(today, 'day')) {
                      return null;
                    }
                    if (booking.start.isAfter(rangeEnd, 'day')) {
                      return null;
                    }
                    const startIdx = booking.start.diff(today, 'day');
                    const endIdx = booking.end.diff(today, 'day');
                    const hasStartInRange = startIdx >= 0 && startIdx <= lastIndex;
                    const hasEndInRange = endIdx >= 0 && endIdx <= lastIndex;
                    const clampedStartIdx = Math.max(0, Math.min(startIdx, lastIndex));
                    const clampedEndIdx = Math.max(0, Math.min(endIdx, lastIndex));
                    const startCenterPercent = (clampedStartIdx + 0.5) * baseUnit;
                    const endCenterPercent = (clampedEndIdx + 0.5) * baseUnit;
                    const visibleStartPercent = hasStartInRange ? startCenterPercent : 0;
                    const visibleEndPercent = hasEndInRange ? endCenterPercent : 100;
                    const widthPercent = Math.max(visibleEndPercent - visibleStartPercent, 0);
                    if (widthPercent <= 0) {
                      return null;
                    }
                    const key = `${booking.giteId}-${booking.debut}-${booking.fin}-${segIdx}`;
                    const lineColor = BOOKING_LINE_COLOR === 'dynamic'
                      ? sourceColor(booking.source)
                      : BOOKING_LINE_COLOR;
                    const leftOffset = hasStartInRange
                      ? `calc(${startCenterPercent}% + ${BOOKING_LINE_AVATAR_CLEARANCE}px)`
                      : `${visibleStartPercent}%`;
                    const widthReductionPx = (hasStartInRange ? BOOKING_LINE_AVATAR_CLEARANCE : 0)
                      + (hasEndInRange ? BOOKING_LINE_AVATAR_CLEARANCE : 0);
                    const widthStyle = widthReductionPx > 0
                      ? `max(${BOOKING_LINE_THICKNESS}px, calc(${widthPercent}% - ${widthReductionPx}px))`
                      : `${widthPercent}%`;
                    const dashStyles = BOOKING_LINE_DASH_SIZE > 0
                      ? {
                          backgroundImage: `radial-gradient(circle, ${lineColor} 0, ${lineColor} 45%, transparent 55%)`,
                          backgroundSize: `${BOOKING_LINE_DASH_SIZE * 2}px ${BOOKING_LINE_THICKNESS}px`,
                          backgroundRepeat: 'repeat-x',
                          backgroundPosition: 'left center',
                          backgroundColor: 'transparent'
                        }
                      : { backgroundColor: lineColor };
                    return (
                      <Box
                        key={key}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: leftOffset,
                          width: widthStyle,
                          height: `${BOOKING_LINE_THICKNESS}px`,
                          transform: 'translateY(-50%)',
                          borderRadius: `${BOOKING_LINE_THICKNESS / 2}px`,
                          opacity: BOOKING_LINE_ALPHA,
                          pointerEvents: 'none',
                          zIndex: 1,
                          ...dashStyles
                        }}
                      />
                    );
                  })}
                {days.map((date, dayIdx) => {
                  const event = giteEvents.find(ev => ev.date.isSame(date, 'day'));
                  const borderRight = dayIdx !== days.length - 1 ? '1px solid #f0f0f0' : 'none';
                  const eventId = event ? buildEventId(event) : null;
                  return (
                    <Box
                      key={date.format('YYYY-MM-DD')}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRight,
                        position: 'relative'
                      }}
                    >
                      {event && renderAvatar(event, eventId)}
                    </Box>
                  );
                })}
              </Box>
            </Tooltip>
          </Box>
        );
      })}
    </>
  );

  const renderSimpleContent = () => (
    <>
      {renderDayHeader()}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          borderTop: '1px solid #ededed'
        }}
      >
        {days.map((date, idx) => {
          const dateKey = date.format('YYYY-MM-DD');
          const dayEvents = eventsByDay.get(dateKey) || [];
          const borderRight = idx !== days.length - 1 ? '1px solid #f0f0f0' : 'none';
          return (
            <Box
              key={dateKey}
              sx={{
                flex: 1,
                borderRight,
                py: GITE_ROW_VERTICAL_PADDING,
                minHeight: computeRowMinHeight,
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                {dayEvents.map(event => {
                  const eventId = buildEventId(event);
                  const avatarNode = renderAvatar(event, eventId);
                  const giteName = giteNameMap.get(event.giteId) || event.giteId;
                  const typeLabel = event.type === 'arrival'
                    ? 'Arrivée'
                    : event.type === 'depart'
                      ? 'Départ'
                      : 'Arrivée + départ';
                  const tooltipTitle = `${giteName} · ${typeLabel}`;
                  return (
                    <Tooltip key={eventId} title={`${tooltipTitle} (${event.source})`}>
                      {avatarNode}
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );

  return (
    <Card sx={{ mb: 3, pb: 0, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ width: '100%', overflowX: 'hidden' }}>
          <Box sx={{ width: '100%' }}>
            {showPeriod ? renderPeriodContent() : renderSimpleContent()}
            {errors.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Tooltip title={`Sources indisponibles: ${errors.join(', ')}`}>
                  <Typography variant="h6">?</Typography>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default CalendarBar;
