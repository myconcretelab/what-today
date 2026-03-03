import test from 'node:test';
import assert from 'node:assert/strict';
import { createContratsIntegration } from '../services/contrats-integration.js';

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test('listAvailabilityReservations maps contrats reservations to what-today gites', async () => {
  const integration = createContratsIntegration({
    baseUrl: 'http://contrats.test',
    explicitGiteMap: {
      edmond: 'gite-edmond-id'
    },
    gites: [
      { id: 'edmond', nom: "Gîte de l'oncle Edmond", couleur: '#43A047' }
    ],
    fetchFn: async (url) => {
      if (url.endsWith('/api/gites')) {
        return createJsonResponse([
          { id: 'gite-edmond-id', nom: 'Oncle Edmond', prefixe_contrat: 'EDM' }
        ]);
      }

      if (url.includes('/api/reservations?')) {
        return createJsonResponse([
          {
            id: 'r1',
            gite_id: 'gite-edmond-id',
            hote_nom: 'Julien Diologent',
            date_entree: '2026-03-10T23:00:00.000Z',
            date_sortie: '2026-03-12T23:00:00.000Z',
            source_paiement: 'Airbnb'
          }
        ]);
      }

      throw new Error(`Unexpected URL ${url}`);
    }
  });

  const rows = await integration.listAvailabilityReservations({ years: [2026] });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    giteId: 'edmond',
    giteNom: "Gîte de l'oncle Edmond",
    couleur: '#43A047',
    source: 'Airbnb',
    debut: '2026-03-10',
    fin: '2026-03-12',
    resume: 'Julien Diologent',
    airbnbUrl: ''
  });
});
