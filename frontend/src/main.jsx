import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import './assets/fonts.css';

// Application configurée en français
// (formats de date, noms des jours...)
dayjs.locale('fr');

const theme = createTheme({
  typography: {
    fontFamily: "'Museo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
    // Bias to available weights: 300 and 700
    fontWeightLight: 300,
    fontWeightRegular: 300,
    fontWeightMedium: 500,
    fontWeightBold: 700
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
