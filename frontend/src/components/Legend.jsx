import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  Select,
  MenuItem,
  IconButton,
  CircularProgress
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { sourceColor, giteInitial } from '../utils';

function Legend({ bookings, selectedUser, onUserChange, onRefresh, refreshing }) {
  const gites = Array.from(
    new Map(bookings.map(b => [b.giteId, b.giteNom])).entries()
  );
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
      <Box sx={{ mr: 5 }}>
        <IconButton
          onClick={onRefresh}
          disabled={refreshing}
          sx={{
            size: 40, // taille de l'icône
            bgcolor: "#f48fb1", // couleur de fond par défaut
            color: "#fff", // couleur de l'icône
            "&:hover": {
              bgcolor: "#f46796ff" // couleur au survol
            },
            "&.Mui-disabled": {
              bgcolor: "grey.100", // couleur quand désactivé
              color: "grey.400"
            }
          }}
        >
          {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
        </IconButton>
      </Box>

      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1,
          mb: 0.5
        }}
      >

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
