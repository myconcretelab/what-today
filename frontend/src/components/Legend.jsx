import React from 'react';
import { Box, Select, MenuItem, Chip, Switch, FormControlLabel } from '@mui/material';
import { lighten, darken } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { sourceColor, TRASH_COLORS } from '../utils';

function Legend({
  bookings,
  selectedUser,
  onUserChange,
  periodEnabled = true,
  onPeriodToggle = () => {}
}) {
  const sources = Array.from(new Set(bookings.map(b => b.source)));

  // Compute text/icon color based on background luminance
  function getContrastingTextColor(bgColor) {
    // Expect hex like #rrggbb
    const hex = (bgColor || '').toString().replace('#', '');
    if (hex.length !== 6) {
      return darken(bgColor, 0.6);
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Perceived brightness (ITU-R BT.601)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // If background is dark, lighten the text; else darken it
    return brightness < 128 ? lighten(bgColor, 0.6) : darken(bgColor, 0.6);
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  const evenWeek = getWeekNumber(new Date()) % 2 === 0;
  const mauronColor = evenWeek ? TRASH_COLORS.yellow : TRASH_COLORS.darkGreen;
  const neantColor = evenWeek ? TRASH_COLORS.darkGreen : TRASH_COLORS.yellow;
  const mauronText = getContrastingTextColor(mauronColor);
  const neantText = getContrastingTextColor(neantColor);

  return (
    <Box sx={{ mb: 2, fontSize: 12 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 2,
          alignItems: 'start'
        }}
      >
        {/* Utilisateurs */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: '100%',
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}
        >
          <Select
            size="small"
            value={selectedUser}
            onChange={e => onUserChange(e.target.value)}
          >
            <MenuItem value="Soaz">Soaz</MenuItem>
            <MenuItem value="Seb">Seb</MenuItem>
          </Select>
          <FormControlLabel
            control={(
              <Switch
                size="small"
                checked={periodEnabled}
                onChange={(event, checked) => onPeriodToggle(checked)}
              />
            )}
            label="Période"
            sx={{ m: 0, ml: { xs: 0, sm: 'auto' } }}
          />
        </Box>

        {/* Sources */}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,  alignItems: "center", justifyContent: "center" }}>
          {/*
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            {sources.map(type => (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    bgcolor: sourceColor(type),
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.3)'
                  }}
                />
                <Typography variant="caption">{type}</Typography>
              </Box>
            ))}
          </Box>
           */}
        </Box>
       

        {/* Poubelles */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,  alignItems: "flex-end", justifyContent: "center"  }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={<DeleteOutlineIcon />}
              label="Néant"
              variant="filled"
              sx={{ backgroundColor: neantColor, color: neantText, '& .MuiChip-icon': { color: 'inherit' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={<DeleteOutlineIcon />}
              label="Mauron"
              variant="filled"
              sx={{ backgroundColor: mauronColor, color: mauronText, '& .MuiChip-icon': { color: 'inherit' } }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Legend;
