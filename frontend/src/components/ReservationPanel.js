import React from 'react';
import { Box, Typography, TextField, Button, Chip } from '@mui/material';

export default function ReservationPanel() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Reservation
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
        Selected gîte • Dates <Chip label="0" size="small" sx={{ ml: 1, bgcolor: '#f48fb1', color: '#fff' }} />
      </Typography>
      <TextField fullWidth multiline rows={4} label="Message" sx={{ mb: 2 }} />
      <Button variant="contained">Save</Button>
    </Box>
  );
}
