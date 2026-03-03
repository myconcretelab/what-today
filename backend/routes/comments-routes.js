import { Router } from 'express';
import { validateDateRangeQuery, validateIsoDateParam } from '../validation.js';

export function createCommentsRouter({
  validGiteIds,
  getCommentsRange,
  getSingleComment
}) {
  const router = Router();
  const giteIdSet = validGiteIds instanceof Set
    ? validGiteIds
    : new Set(Array.isArray(validGiteIds) ? validGiteIds : []);

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
      if (typeof getCommentsRange !== 'function') {
        return res.status(500).json({
          success: false,
          error: 'Comments provider is not configured'
        });
      }

      const direct = await getCommentsRange(startIso, endIso);
      return res.json(direct || {});
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/comments/:giteId/:date', async (req, res) => {
    const { giteId, date } = req.params;
    if (!giteIdSet.has(giteId)) {
      return res.status(400).json({ success: false, error: 'Invalid gite' });
    }

    const dateValidation = validateIsoDateParam(date);
    if (!dateValidation.ok) {
      return res.status(400).json({ success: false, error: dateValidation.error });
    }
    const isoDate = dateValidation.value;

    try {
      if (typeof getSingleComment !== 'function') {
        return res.status(500).json({
          success: false,
          error: 'Comments provider is not configured'
        });
      }

      const direct = await getSingleComment(giteId, isoDate);
      return res.json(direct || { comment: 'pas de commentaires', phone: '' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
