import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { validateHarImportPayload, validateHarUploadPayload } from '../validation.js';

export function createImportRouter({
  backendDir,
  parseHarReservationsByListing,
  writeTextFileQueued,
  resolveGiteId,
  sheetNames,
  splitReservationByMonth,
  buildPreviewResponse,
  awaitIcalLoadIfNeeded,
  startIcalLoad,
  buildIcalFlatReservations,
  importReservationsToSheets,
  buildImportLogEntry,
  recordImportLog
}) {
  const router = Router();

  router.post('/upload-har', async (req, res) => {
    const validation = validateHarUploadPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const dest = path.join(backendDir, 'www.airbnb.fr.har');
      await writeTextFileQueued(dest, JSON.stringify(validation.value, null, 2));
      res.json({ success: true, path: dest });
    } catch (err) {
      console.error('Failed to save HAR:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/har-calendar', (req, res) => {
    try {
      const harPath = path.join(backendDir, 'www.airbnb.fr.har');
      if (!fs.existsSync(harPath)) {
        return res.status(404).json({ success: false, error: 'HAR not found' });
      }
      const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
      const data = parseHarReservationsByListing(har);
      res.json(data);
    } catch (err) {
      console.error('Failed to parse HAR:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/har/preview', async (req, res) => {
    const validation = validateHarUploadPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const har = validation.value;
      const parsed = parseHarReservationsByListing(har);
      const flat = [];
      for (const [listingName, items] of Object.entries(parsed || {})) {
        const giteId = resolveGiteId(listingName);
        const sheetName = giteId ? sheetNames[giteId] : null;
        for (const item of items || []) {
          const baseReservation = {
            type: item.type || 'personal',
            checkIn: item.checkIn,
            checkOut: item.checkOut,
            nights: item.nights,
            name: item.name || '',
            payout: typeof item.payout === 'number' ? item.payout : null,
            comment: item.comment || ''
          };
          const segments = splitReservationByMonth(baseReservation);
          for (const seg of segments) {
            flat.push({
              giteId,
              giteName: listingName,
              sheetName,
              ...seg
            });
          }
        }
      }

      const preview = await buildPreviewResponse(flat);
      res.json({ success: true, ...preview });
    } catch (err) {
      console.error('Failed to preview HAR:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/ical/preview', async (req, res) => {
    try {
      await awaitIcalLoadIfNeeded();
      const flat = buildIcalFlatReservations();
      const preview = await buildPreviewResponse(flat);
      res.json({ success: true, ...preview });
    } catch (err) {
      console.error('Failed to preview ICAL:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const handleIcalImport = async (req, res) => {
    try {
      await awaitIcalLoadIfNeeded();
      await startIcalLoad({ reset: true });
      await awaitIcalLoadIfNeeded();

      const flat = buildIcalFlatReservations();
      const preview = await buildPreviewResponse(flat);
      const importable = (preview.reservations || []).filter(r => (
        r.status === 'new'
        || r.status === 'price_missing'
        || r.status === 'comment_missing'
        || r.status === 'price_comment_missing'
        || r.status === 'name_missing'
      ));

      const summary = await importReservationsToSheets(importable, { allowCommentUpdate: false });
      await recordImportLog(buildImportLogEntry({
        source: 'ical',
        selectionCount: importable.length,
        summary
      }));
      res.json({ success: true, selectionCount: importable.length, ...summary });
    } catch (err) {
      console.error('Failed to import ICAL:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  };

  router.post('/ical/import', handleIcalImport);
  router.get('/ical/import', handleIcalImport);

  router.post('/har/import', async (req, res) => {
    const validation = validateHarImportPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const incomingReservations = validation.value.reservations;
      const summary = await importReservationsToSheets(incomingReservations);
      await recordImportLog(buildImportLogEntry({
        source: 'har',
        selectionCount: incomingReservations.length,
        summary
      }));
      res.json({ success: true, ...summary });
    } catch (err) {
      console.error('Failed to import HAR:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
