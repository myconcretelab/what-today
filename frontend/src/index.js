import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

// Application configurée en français
// (formats de date, noms des jours...)
dayjs.locale('fr');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
