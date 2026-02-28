import { Router } from 'express';
import dayjs from 'dayjs';
import { validateDateRangeQuery, validateIsoDateParam } from '../validation.js';

export function createCommentsRouter({
  sheetNames,
  readCommentsCache,
  commentsKey,
  refreshCommentsForAllGitesInRange,
  refreshSingleComment
}) {
  const router = Router();

  router.get('/comments-range', async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ success: false, error: 'Missing date range' });
    }

    const rangeValidation = validateDateRangeQuery(start, end, { maxDays: 366 });
    if (!rangeValidation.ok) {
      return res.status(400).json({ success: false, error: rangeValidation.error });
    }

    const { start: startIso, end: endIso } = rangeValidation.value;
    try {
      const startDate = dayjs(startIso, 'YYYY-MM-DD', true);
      const endDate = dayjs(endIso, 'YYYY-MM-DD', true);

      const cache = readCommentsCache();
      const results = {};
      for (const [giteId] of Object.entries(sheetNames)) {
        for (const [key, val] of Object.entries(cache)) {
          if (!key.startsWith(`${giteId}_`)) continue;
          const iso = key.slice(giteId.length + 1);
          const d = dayjs(iso, 'YYYY-MM-DD');
          if (!d.isValid()) continue;
          if (!d.isBefore(startDate) && !d.isAfter(endDate)) {
            results[key] = { comment: val.comment || '', phone: val.phone || '' };
          }
        }
      }
      res.json(results);

      refreshCommentsForAllGitesInRange(startIso, endIso).catch(err => {
        console.error('Background refresh failed:', err.message);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/comments/:giteId/:date', async (req, res) => {
    const { giteId, date } = req.params;
    const sheetName = sheetNames[giteId];
    if (!sheetName) {
      return res.status(400).json({ success: false, error: 'Invalid gite' });
    }

    const dateValidation = validateIsoDateParam(date);
    if (!dateValidation.ok) {
      return res.status(400).json({ success: false, error: dateValidation.error });
    }
    const isoDate = dateValidation.value;

    try {
      const cache = readCommentsCache();
      const key = commentsKey(giteId, isoDate);
      const cached = cache[key];
      const immediate = cached?.comment || 'pas de commentaires';
      res.json({ comment: immediate, phone: cached?.phone || '' });

      refreshSingleComment(giteId, isoDate).catch(err => {
        console.error('Background single refresh failed:', err.message);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
