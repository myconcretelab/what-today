import React from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { sourceColor } from '../utils';

function Legend({ bookings, selectedUser, onUserChange }) {
  const sources = Array.from(new Set(bookings.map(b => b.source)));

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
    </Box>
  );
}

export default Legend;
