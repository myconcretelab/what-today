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

// Apply saved Google Font selection if any (before render)
function initSavedFont() {
  try {
    const stack = localStorage.getItem('wt-font-family');
    const href = localStorage.getItem('wt-font-url');
    if (stack) {
      // Inject link
      if (href) {
        const linkId = 'wt-google-font';
        let link = document.getElementById(linkId);
        if (!link) {
          link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
        link.href = href;
      }
      // Inject style override
      const styleId = 'wt-font-override';
      let style = document.getElementById(styleId);
      const css = `:root{--wt-font:${stack}} body, .MuiTypography-root{ font-family: var(--wt-font) !important; }`;
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
      } else {
        style.textContent = css;
      }
    }
  } catch {}
}

initSavedFont();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
