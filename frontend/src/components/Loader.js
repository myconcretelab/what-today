import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/** Loader central élégant affiché durant la récupération des données */
function Loader() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2
      }}
    >
      <CircularProgress color="secondary" />
      <Typography>Chargement des réservations...</Typography>
    </Box>
  );
}

export default Loader;
