import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

// Application configurée en français
// (formats de date, noms des jours...)
dayjs.locale('fr');

const theme = createTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
