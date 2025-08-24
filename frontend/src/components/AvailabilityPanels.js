import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Box,
  Card,
  Chip,
  Typography,
  TextField,
  MenuItem,
  Button,
  Popover,
  Checkbox,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import useAvailability from '../hooks/useAvailability';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import {
  SAVE_RESERVATION,
  fetchSchoolHolidays,
  fetchPublicHolidays
} from '../services/api';

// Enable plugin
dayjs.extend(isSameOrAfter);
dayjs.locale('fr');

const GITE_LABELS = {
  phonsine: 'de Tante Phonsine à Néant sur Yvel',
  gree: 'de la Grée à Néant sur Yvel',
  edmond: "de l'Oncle Edmond à Néant sur Yvel",
  liberte: 'du Liberté à Mauron'
};

const GITE_LINKS = {
  liberte: 'https://www.airbnb.fr/multicalendar/48504640',
  gree: 'https://www.airbnb.fr/multicalendar/16674752',
  phonsine: 'https://www.airbnb.fr/multicalendar/6668903',
  edmond: 'https://www.airbnb.fr/multicalendar/43504621'
};

const AvailabilityContext = createContext(null);

export function AvailabilityProvider({ bookings, children }) {
  const [arrival, setArrival] = useState(dayjs());
  const [departure, setDeparture] = useState(dayjs().add(1, 'day'));
  const [range, setRange] = useState(1);
  const [selectedGite, setSelectedGite] = useState(null);
  const [info, setInfo] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [draps, setDraps] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const availability = useAvailability(bookings, arrival, departure, range);
  const [holidayDates, setHolidayDates] = useState(new Set());
  const [publicHolidayDates, setPublicHolidayDates] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [airbnbUrl, setAirbnbUrl] = useState(null);

  useEffect(() => {
    const parts = [];
    if (name) parts.push(`N: ${name}`);
    if (phone) parts.push(`T: ${phone}`);
    parts.push(`Draps: ${draps ? 'oui' : 'non'}`);
    setInfo(parts.join('\n'));
  }, [name, phone, draps]);

  useEffect(() => {
    fetchSchoolHolidays()
      .then(data => {
        const dates = new Set();
        data.forEach(h => {
          let d = dayjs(h.start);
          const end = dayjs(h.end);
          for (; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
            dates.add(d.format('YYYY-MM-DD'));
          }
        });
        setHolidayDates(dates);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPublicHolidays()
      .then(data => {
        setPublicHolidayDates(new Set(Object.keys(data)));
      })
      .catch(() => {});
  }, []);

  const handlePhoneChange = e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    const formatted = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    setPhone(formatted);
  };

  const handleOpenPicker = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePicker = () => {
    setAnchorEl(null);
  };

  const handleRangeChange = newRange => {
    if (!newRange.startDate || !newRange.endDate) return;
    setArrival(dayjs(newRange.startDate));
    setDeparture(dayjs(newRange.endDate));
  };

  const handleReserve = (g, onGoto) => {
    setSelectedGite(g);
    if (onGoto) onGoto();
  };

  const handleSave = () => {
    if (!selectedGite) return;
    setSaving(true);
    setSaveError(false);
    setAirbnbUrl(null);

    navigator.clipboard?.writeText(info).catch(() => {});

    (async () => {
      const payload = {
        giteId: selectedGite.id,
        name,
        start: arrival.format('DD/MM/YYYY'),
        end: departure.format('DD/MM/YYYY'),
        summary: info.replace(/\n/g, ' ')
      };

      try {
        const res = await fetch(SAVE_RESERVATION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('save failed');

        const start = arrival.format('YYYY-MM-DD');
        const end = departure.subtract(1, 'day').format('YYYY-MM-DD');
        const link = GITE_LINKS[selectedGite.id];
        const url = link ? `${link}/edit-selected-dates/${start}/${end}` : null;
        setAirbnbUrl(url);
      } catch (e) {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    })();
  };

  const renderDayContent = date => {
    const formatted = dayjs(date).format('YYYY-MM-DD');
    const isVacation = holidayDates.has(formatted);
    const isPublicHoliday = publicHolidayDates.has(formatted);
    const d = dayjs(date);
    const isSelected = !d.isBefore(arrival, 'day') && !d.isAfter(departure, 'day');
    let backgroundColor;
    if (isSelected && isPublicHoliday) {
      backgroundColor = '#8a73fbff';
    } else if (isPublicHoliday) {
      backgroundColor = '#ffe1a5ff';
    } else if (isSelected && isVacation) {
      backgroundColor = '#8a73fbff';
    } else if (isVacation) {
      backgroundColor = '#ffe1a5ff';
    }
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          color: isSelected ? '#fff' : '#555',
          borderRadius: '5%'
        }}
      >
        {d.date()}
      </div>
    );
  };

  const reservationText = selectedGite
    ? `Bonjour,\nJe vous confirme votre réservation pour le gîte ${GITE_LABELS[selectedGite.id]} du ${arrival
        .locale('fr')
        .format('D MMMM YYYY')} à partir de 17h au ${departure
        .locale('fr')
        .format('D MMMM YYYY')} midi.\nMerci Beaucoup,\nSoazig Molinier`
    : '';

  return (
    <AvailabilityContext.Provider
      value={{
        arrival,
        departure,
        range,
        setRange,
        handleOpenPicker,
        anchorEl,
        handleClosePicker,
        handleRangeChange,
        availability,
        handleReserve,
        selectedGite,
        name,
        setName,
        phone,
        setPhone,
        draps,
        setDraps,
        info,
        handlePhoneChange,
        handleSave,
        saving,
        saveError,
        airbnbUrl,
        reservationText
      }}
    >
      {children}
    </AvailabilityContext.Provider>
  );
}

export function AvailabilityPeriodPanel({ onReserve }) {
  const {
    arrival,
    departure,
    range,
    setRange,
    handleOpenPicker,
    anchorEl,
    handleClosePicker,
    handleRangeChange,
    availability,
    handleReserve
  } = useContext(AvailabilityContext);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Choisir des dates
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Période"
          value={`${arrival.format('YYYY-MM-DD')} - ${departure.format('YYYY-MM-DD')}`}
          onClick={handleOpenPicker}
          InputProps={{ readOnly: true }}
        />
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClosePicker}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <DateRange
            ranges={[
              { startDate: arrival.toDate(), endDate: departure.toDate(), key: 'selection' }
            ]}
            onChange={item => handleRangeChange(item.selection)}
            dayContentRenderer={renderDayContent}
          />
        </Popover>
        <TextField
          select
          label="Plage"
          value={range}
          onChange={e => setRange(Number(e.target.value))}
        >
          <MenuItem value={1}>1 jour</MenuItem>
          <MenuItem value={2}>2 jours</MenuItem>
          <MenuItem value={3}>3 jours</MenuItem>
          <MenuItem value={4}>4 jours</MenuItem>
        </TextField>
      </Box>
      {availability.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {availability.map(g => (
            <Card key={g.id} sx={{ p: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: g.free ? '#64b5f6' : '#f48fb1' }}>{g.name}</Typography>
                {g.free ? (
                  <Button variant="contained" size="small" onClick={() => handleReserve(g, onReserve)}>
                    Réserver
                  </Button>
                ) : (
                  <Chip
                    label="Occupé"
                    variant="outlined"
                    sx={{
                      color: '#f48fb1',
                      borderColor: '#f48fb1'
                    }}
                    size="small"
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', mb: 0.5 }}>
                {g.segments.map(s => (
                  <Typography
                    key={s.date}
                    variant="caption"
                    sx={{
                      flex: 1,
                      textAlign: 'center',
                      color: s.busy ? '#f48fb1' : '#64b5f6'
                    }}
                  >
                    {dayjs(s.date).format('dd')[0].toLowerCase()}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ display: 'flex', mt: 0.5 }}>
                {g.segments.map(s => {
                  const isSelected =
                    dayjs(s.date).isSameOrAfter(arrival, 'day') &&
                    dayjs(s.date).isBefore(departure, 'day');
                  return (
                    <Box
                      key={s.date}
                      sx={{
                        flex: 1,
                        height: isSelected ? 8 : 4,
                        bgcolor: s.busy ? '#f48fb1' : '#64b5f6'
                      }}
                    />
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', mt: 0.5 }}>
                {g.segments.map(s => (
                  <Typography
                    key={s.date}
                    variant="caption"
                    sx={{
                      flex: 1,
                      textAlign: 'center',
                      color: s.busy ? '#f48fb1' : '#64b5f6'
                    }}
                  >
                    {dayjs(s.date).format('DD')}
                  </Typography>
                ))}
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function AvailabilityReservationPanel() {
  const {
    arrival,
    departure,
    selectedGite,
    name,
    setName,
    phone,
    setPhone,
    draps,
    setDraps,
    info,
    handlePhoneChange,
    handleSave,
    saving,
    saveError,
    airbnbUrl,
    reservationText
  } = useContext(AvailabilityContext);

  const nights = departure.diff(arrival, 'day');

  return (
    <Box sx={{ p: 2, overflowY: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Réservation
      </Typography>
      {selectedGite && (
        <Typography
          variant="subtitle2"
          sx={{ color: 'grey.600', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {selectedGite.name} — {arrival.format('DD/MM/YYYY')} au {departure.format('DD/MM/YYYY')}
          <Chip label={`${nights} nuits`} size="small" sx={{ bgcolor: '#f48fb1', color: '#fff' }} />
        </Typography>
      )}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Infos Résa
      </Typography>
      <TextField
        label="Téléphone"
        value={phone}
        onChange={handlePhoneChange}
        placeholder="00 00 00 00 00"
        inputProps={{ inputMode: 'numeric' }}
        sx={{ mb: 1 }}
      />&nbsp;&nbsp;
      <TextField
        label="Nom/prénom"
        value={name}
        onChange={e => setName(e.target.value)}
        sx={{ mb: 1 }}
      />&nbsp;&nbsp;
      <FormControlLabel
        control={<Checkbox checked={draps} onChange={e => setDraps(e.target.checked)} />}
        label="Draps"
        sx={{ mb: 1 }}
      />
      <TextField
        multiline
        rows={4}
        fullWidth
        value={info}
        InputProps={{ readOnly: true }}
        sx={{ mb: 1 }}
      />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {airbnbUrl ? (
          <Button
            component="a"
            href={airbnbUrl}
            target="_blank"
            rel="noopener"
            variant="contained"
            size="small"
          >
            Calendrier Airbnb
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            color={saveError ? 'error' : saving ? 'warning' : 'primary'}
            onClick={handleSave}
          >
            {saving && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
            {saveError ? 'Erreur !' : 'Sauvegarder'}
          </Button>
        )}
      </Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        SMS
      </Typography>
      <Box sx={{ border: '1px solid', borderColor: 'grey.400', borderRadius: 1, p: 2, mb: 1 }}>
        <Typography sx={{ whiteSpace: 'pre-line' }}>{reservationText}</Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={() => navigator.clipboard.writeText(reservationText)}
        sx={{ mb: 2 }}
      >
        Copier
      </Button>
    </Box>
  );
}
