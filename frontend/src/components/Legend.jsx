import React from 'react';
import { Box, Typography, Select, MenuItem, Chip } from '@mui/material';
import { lighten, darken } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 2,
          alignItems: 'start'
        }}
      >
        {/* Utilisateurs */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,  alignItems: "center", justifyContent: "center"  }}>
          <Select
            size="small"
            value={selectedUser}
            onChange={e => onUserChange(e.target.value)}
          >
            <MenuItem value="Soaz">Soaz</MenuItem>
            <MenuItem value="Seb">Seb</MenuItem>
          </Select>
        </Box>

        {/* Sources */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,  alignItems: "center", justifyContent: "center" }}>
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
        </Box>

        {/* Poubelles */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,  alignItems: "center", justifyContent: "center"  }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DeleteOutlineIcon fontSize="small" sx={{ color: neantColor }} />
            <Chip label="Néant" variant="filled" sx={{ backgroundColor: neantColor, color: darken(neantColor, 0.5) }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DeleteOutlineIcon fontSize="small" sx={{ color: mauronColor }} />
            <Chip label="Mauron" variant="filled" sx={{ backgroundColor: mauronColor, color: lighten(mauronColor, 0.5)  }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Legend;
