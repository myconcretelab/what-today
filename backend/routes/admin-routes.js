import { Router } from 'express';
import { IMPORT_LOG_LIMIT, SHEET_NAMES } from '../config.js';
import {
  validateStatusUpdatePayload,
  validatePricesPayload,
  validateTextsPayload,
  validateDataPayload
} from '../validation.js';
import {
  readStatuses,
  writeStatuses,
  readImportLog,
  readPrices,
  writePrices,
  readTexts,
  writeTexts,
  readData,
  writeData
} from '../store/local-data-store.js';

const VALID_GITE_IDS = new Set(Object.keys(SHEET_NAMES));

export function createAdminRouter() {
  const router = Router();

  router.get('/statuses', (req, res) => {
    res.json(readStatuses());
  });

  router.post('/statuses/:id', async (req, res) => {
    const statusId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(statusId)) {
      return res.status(400).json({ success: false, error: 'Invalid status id' });
    }

    const validation = validateStatusUpdatePayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const statuses = readStatuses();
      statuses[statusId] = validation.value;
      await writeStatuses(statuses);
      res.json(statuses[statusId]);
    } catch (err) {
      console.error('Failed to save status:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/import-log', (req, res) => {
    const rawLimit = parseInt(req.query.limit, 10);
    const log = readImportLog();
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, IMPORT_LOG_LIMIT)
      : 5;
    res.json({ entries: log.slice(0, limit), total: log.length });
  });

  router.get('/prices', (req, res) => {
    res.json(readPrices());
  });

  router.post('/prices', async (req, res) => {
    const validation = validatePricesPayload(req.body, VALID_GITE_IDS);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      await writePrices(validation.value);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to save prices:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/texts', (req, res) => {
    res.json(readTexts());
  });

  router.post('/texts', async (req, res) => {
    const validation = validateTextsPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      await writeTexts(validation.value);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to save texts:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/data', (req, res) => {
    res.json(readData());
  });

  router.post('/data', async (req, res) => {
    const validation = validateDataPayload(req.body, VALID_GITE_IDS);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      await writeData(validation.value);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to save data:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
