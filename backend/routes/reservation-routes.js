import { Router } from 'express';
import { validateSaveReservationPayload } from '../validation.js';

export function createReservationRouter({
  validGiteIds,
  saveReservation
}) {
  const router = Router();
  const giteIdSet = validGiteIds instanceof Set
    ? validGiteIds
    : new Set(Array.isArray(validGiteIds) ? validGiteIds : []);

  router.post('/save-reservation', async (req, res) => {
    const validation = validateSaveReservationPayload(req.body, giteIdSet);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const { giteId, name, start, end, summary, price, phone } = validation.value;

      if (typeof saveReservation !== 'function') {
        return res.status(500).json({
          success: false,
          error: 'Reservation persistence is not configured'
        });
      }

      await saveReservation({ giteId, name, start, end, summary, price, phone });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
