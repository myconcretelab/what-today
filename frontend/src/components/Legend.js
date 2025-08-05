import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { Phone } from '@mui/icons-material';
import { sourceLogo } from '../utils';

function Legend({ bookings }) {
  const gites = Array.from(
    new Map(bookings.map(b => [b.giteNom, b.couleur])).entries()
  );
  const sources = Array.from(new Set(bookings.map(b => b.source)));

  return (
    <Box sx={{ mb: 2, fontSize: 12 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1,
          mb: 0.5
        }}
      >
        {gites.map(([name, color]) => (
          <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                bgcolor: color,
                borderRadius: '50%',
                border: '1px solid rgba(0,0,0,0.3)'
              }}
            />
            <Typography variant="caption">{name}</Typography>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1
        }}
      >
        {sources.map(type => {
          const logo = sourceLogo(type);
          return (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar
                src={logo || undefined}
                sx={{ width: 16, height: 16, bgcolor: logo ? '#fff' : 'transparent' }}
              >
                {!logo && <Phone sx={{ fontSize: 14 }} />}
              </Avatar>
              <Typography variant="caption">{type}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default Legend;
