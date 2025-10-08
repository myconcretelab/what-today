import React from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  TextField,
  Button,
  Popover,
  IconButton
} from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import dayjs from 'dayjs';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAvailabilityContext } from './AvailabilityProvider.jsx';
import { useThemeColors } from '../theme.jsx';

export function AvailabilityPeriodPanel({ onReserve, onBack, panelBg }) {
  const {
    arrival,
    departure,
    handleOpenPicker,
    anchorEl,
    handleClosePicker,
    handleRangeChange,
    availability,
    handleReserve,
    renderDayContent
  } = useAvailabilityContext();

  const nightCount = departure.diff(arrival, 'day');
  const theme = useTheme();
  const headerColor = theme.palette.getContrastText(panelBg || '#ffffff');
  const { theme: colorTheme } = useThemeColors();

  return (
    <Box sx={{ p: 2, pl: { xs: 1, sm: 2 } }}>
      <GlobalStyles
        styles={{
          '.rdrDayPassive': { pointerEvents: 'auto' },
          '.rdrDayPassive .rdrDayNumber': { pointerEvents: 'auto' },
          '.rdrDayPassive .rdrDayNumber span': { pointerEvents: 'auto' }
        }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={onBack} size="large" sx={{ color: headerColor }}>
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Typography variant="h6" sx={{ color: headerColor }}>Choisir des dates</Typography>
      </Box>
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField
              sx={{
                width: 320,
                '& .MuiInputBase-input': { fontSize: { xs: 13, sm: 18 } }
              }}
              label="Période"
              value={`${arrival.format('DD/MM/YY')} - ${departure.format('DD/MM/YY')}`}
              onClick={handleOpenPicker}
              InputProps={{ readOnly: true }}
            />
            <Popover
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={handleClosePicker}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              disableRestoreFocus
            >
              <Box sx={{ p: 1 }}>
                <DateRange
                  ranges={[
                    { startDate: arrival.toDate(), endDate: departure.toDate(), key: 'selection' }
                  ]}
                  onChange={item => handleRangeChange(item.selection)}
                  dayContentRenderer={renderDayContent}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button variant="contained" size="small" onClick={handleClosePicker}>
                    ok
                  </Button>
                </Box>
              </Box>
            </Popover>
            <Chip label={`${nightCount} nuits`} size="small" sx={{ bgcolor: '#f48fb1', color: '#fff' }} />
          </Box>
          {availability.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {availability.map(g => (
                <Card key={g.id} sx={{ p: 1, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
                        dayjs(s.date).isSameOrAfter(arrival, 'day') && dayjs(s.date).isBefore(departure, 'day');
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
        </CardContent>
      </Card>
    </Box>
  );
}
