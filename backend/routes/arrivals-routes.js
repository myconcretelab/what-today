import { Router } from 'express';
import dayjs from 'dayjs';

export function createArrivalsRouter({
  awaitIcalLoadIfNeeded,
  startIcalLoad,
  getReservations,
  getErrors
}) {
  const router = Router();

  router.get('/arrivals', async (req, res) => {
    await awaitIcalLoadIfNeeded();
    const reservations = Array.isArray(getReservations()) ? getReservations() : [];
    const errors = getErrors();
    const today = dayjs().startOf('day');
    const startWindow = today.subtract(5, 'day');
    const endWindow = reservations.reduce((max, ev) => {
      const fin = dayjs(ev.fin);
      return fin.isAfter(max) ? fin : max;
    }, startWindow);
    const dates = [];
    for (let d = startWindow; !d.isAfter(endWindow); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'));
    }
    res.json({
      genereLe: new Date().toISOString(),
      reservations,
      erreurs: Array.from(errors || []),
      dates
    });
  });

  router.post('/reload-icals', async (req, res) => {
    try {
      await awaitIcalLoadIfNeeded();
      await startIcalLoad({ reset: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
