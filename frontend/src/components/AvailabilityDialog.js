import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Chip,
  Typography,
  Card,
  TextField,
  MenuItem,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import useAvailability from '../hooks/useAvailability';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// Activer le plugin
dayjs.extend(isSameOrAfter);
dayjs.locale('fr');

const GITE_LABELS = {
  phonsine: 'de Tante Phonsine à Néant sur Yvel',
  gree: 'de la Grée à Néant sur Yvel',
  edmond: "de l'Oncle Edmond à Néant sur Yvel",
  liberte: 'du Liberté à Mauron'
};

export default function AvailabilityDialog({ open, onClose, bookings }) {
  const [arrival, setArrival] = useState(dayjs());
  const [departure, setDeparture] = useState(dayjs().add(1, 'day'));
  const [range, setRange] = useState(1);
  const [showReservation, setShowReservation] = useState(false);
  const [selectedGite, setSelectedGite] = useState(null);
  const [note, setNote] = useState('');
  const availability = useAvailability(bookings, arrival, departure, range);

  const handleArrival = date => {
    if (!date) return;
    setArrival(date);
    if (!date.add(1, 'day').isBefore(departure)) {
      setDeparture(date.add(1, 'day'));
    }
  };

  const handleDeparture = date => {
    if (!date) return;
    if (date.isBefore(arrival.add(1, 'day'))) {
      setDeparture(arrival.add(1, 'day'));
    } else {
      setDeparture(date);
    }
  };

  const handleReserve = g => {
    setSelectedGite(g);
    setShowReservation(true);
  };

  const reservationText = selectedGite
    ? `Bonjour,\nJe vous confirme votre réservation pour le gîte ${GITE_LABELS[selectedGite.id]} du ${arrival
        .locale('fr')
        .format('D MMMM YYYY')} au ${departure
        .locale('fr')
        .format('D MMMM YYYY')}.\nMerci Beaucoup,\nSoazig Molinier`
    : '';

  const handleClose = () => {
    setShowReservation(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth>
      <Box sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex',
            width: '200%',
            transform: showReservation ? 'translateX(-50%)' : 'translateX(0)',
            transition: 'transform 0.3s'
          }}
        >
          <Box sx={{ width: '50%' }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Choisir des dates
              <IconButton aria-label="Fermer" onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Arrivée"
                  type="date"
                  value={arrival.format('YYYY-MM-DD')}
                  onChange={e => handleArrival(dayjs(e.target.value))}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Départ"
                  type="date"
                  value={departure.format('YYYY-MM-DD')}
                  onChange={e => handleDeparture(dayjs(e.target.value))}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: arrival.add(1, 'day').format('YYYY-MM-DD') }}
                />
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
                          <Button variant="contained" size="small" onClick={() => handleReserve(g)}>
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
            </DialogContent>
          </Box>
          <Box sx={{ width: '50%' }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => setShowReservation(false)}>
                <ArrowBackIcon sx={{ fontSize: 32 }} />
              </IconButton>
              Réservation
            </DialogTitle>
            <DialogContent>
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
              <TextField
                multiline
                rows={4}
                fullWidth
                value={note}
                onChange={e => setNote(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Button variant="contained" size="small" onClick={() => navigator.clipboard.writeText(note)}>
                Copier
              </Button>
            </DialogContent>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
