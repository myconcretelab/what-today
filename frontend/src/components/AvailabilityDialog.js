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
  TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import useAvailability from '../hooks/useAvailability';

export default function AvailabilityDialog({ open, onClose, bookings }) {
  const [arrival, setArrival] = useState(dayjs());
  const [departure, setDeparture] = useState(dayjs().add(1, 'day'));
  const availability = useAvailability(bookings, arrival, departure);

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

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Choisir des dates
        <IconButton aria-label="Fermer" onClick={onClose}>
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
        </Box>
        {availability.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {availability.map(g => (
              <Card key={g.id} sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography>{g.name}</Typography>
                  <Chip
                    label={g.free ? 'Libre' : 'Occupé'}
                    color={g.free ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', mt: 1 }}>
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
                      {dayjs(s.date).format('DD/MM')}
                    </Typography>
                  ))}
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
