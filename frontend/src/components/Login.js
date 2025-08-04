import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

/**
 * Écran de demande de mot de passe (affiché uniquement lors
 * de la première visite). Le mot de passe attendu est fourni
 * par la prop `onLogin`.
 */
function Login({ onLogin }) {
  const [password, setPassword] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2
      }}
    >
      <Typography variant="h5">Accès réservé</Typography>
      <TextField
        type="password"
        label="Mot de passe"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <Button variant="contained" type="submit">
        Entrer
      </Button>
    </Box>
  );
}

export default Login;
