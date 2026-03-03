import { Router } from 'express';
import { SHEET_NAMES } from '../config.js';
import {
  validateStatusUpdatePayload,
  validatePricesPayload,
  validateTextsPayload,
  validateDataPayload
} from '../validation.js';
import {
  readStatuses,
  writeStatuses,
  readPrices,
  writePrices,
  readTexts,
  writeTexts,
  readData,
  writeData
} from '../store/local-data-store.js';

const VALID_GITE_IDS = new Set(Object.keys(SHEET_NAMES));

export function createAdminRouter({ listContratsGites } = {}) {
  const router = Router();

  router.get('/contrats-gites', async (_req, res) => {
    if (typeof listContratsGites !== 'function') {
      return res.json({ enabled: false, gites: [] });
    }

    try {
      const gites = await listContratsGites();
      return res.json({ enabled: true, gites: Array.isArray(gites) ? gites : [] });
    } catch (err) {
      console.error('Failed to load contrats gites:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

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
