import React from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { sourceColor, TRASH_COLORS } from '../utils';

function Legend({ bookings, selectedUser, onUserChange }) {
  const sources = Array.from(new Set(bookings.map(b => b.source)));

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

  return (
    <Box sx={{ mb: 2, fontSize: 12 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1
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
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          mt: 1,
          gap: 0.5
        }}
      >
        <Typography variant="caption">Poubelles</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              bgcolor: neantColor,
              borderRadius: '50%',
              border: '1px solid rgba(0,0,0,0.3)'
            }}
          />
          <Typography variant="caption">Néant</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              bgcolor: mauronColor,
              borderRadius: '50%',
              border: '1px solid rgba(0,0,0,0.3)'
            }}
          />
          <Typography variant="caption">Mauron</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Legend;
