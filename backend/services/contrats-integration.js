import crypto from 'crypto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const DATE_ISO_FORMAT = 'YYYY-MM-DD';
const GITES_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseExplicitMap(rawValue) {
  if (!rawValue) return {};

  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return Object.fromEntries(
      Object.entries(rawValue).map(([key, value]) => [String(key).trim(), String(value || '').trim()])
    );
  }

  if (typeof rawValue !== 'string') return {};
  const trimmed = rawValue.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [String(key).trim(), String(value || '').trim()])
      );
    } catch {
      return {};
    }
  }

  const map = {};
  const lines = trimmed.split(/[\n,;]/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const separator = line.includes('=') ? '=' : (line.includes(':') ? ':' : null);
    if (!separator) continue;
    const [left, ...rest] = line.split(separator);
    const key = String(left || '').trim();
    const value = String(rest.join(separator) || '').trim();
    if (!key || !value) continue;
    map[key] = value;
  }
  return map;
}

function createRequestHeaders({ apiToken, basicPassword, basicUser }) {
  if (apiToken) {
    return {
      Authorization: `Bearer ${apiToken}`
    };
  }

  if (basicPassword) {
    const encoded = Buffer.from(`${basicUser || 'what-today'}:${basicPassword}`).toString('base64');
    return {
      Authorization: `Basic ${encoded}`
    };
  }

  return {};
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload, status) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return `HTTP ${status}`;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function parseIsoDate(value) {
  const parsed = dayjs(value, DATE_ISO_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function parseFrDate(value) {
  const parsed = dayjs(value, 'DD/MM/YYYY', true);
  return parsed.isValid() ? parsed : null;
}

function overlapsCurrentYear(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const endExclusive = parseIsoDate(endIso);
  if (!start || !endExclusive) return false;
  const year = dayjs().year();
  const yearStart = dayjs(`${year}-01-01`, DATE_ISO_FORMAT, true);
  const yearEnd = dayjs(`${year}-12-31`, DATE_ISO_FORMAT, true);
  const endInclusive = endExclusive.subtract(1, 'day');
  return !start.isAfter(yearEnd, 'day') && !endInclusive.isBefore(yearStart, 'day');
}

function toIsoDate(value) {
  if (typeof value === 'string') {
    const directMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch && directMatch[1]) return directMatch[1];
  } else if (!(value instanceof Date)) {
    return null;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(DATE_ISO_FORMAT) : null;
}

function parseAdultsFromText(value) {
  if (typeof value !== 'string') return 0;
  const match = value.match(/Adultes:\s*(\d+)/i);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function extractPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const match = value.match(/\bT:\s*([0-9 +().-]+)/i);
  return match ? match[1].trim() : '';
}

function normalizeSourceLabel(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (normalizeText(trimmed) === normalizeText('direct')) return 'A définir';
  return trimmed;
}

function toContratsSource(value, type) {
  const normalized = normalizeText(value);
  const normalizedType = normalizeText(type);

  if (normalized.includes('airbnb') || normalizedType === 'airbnb') return 'Airbnb';
  if (normalized.includes('abritel')) return 'Abritel';
  if (normalized.includes('gites') || normalized.includes('gites de france')) return 'Gites de France';
  if (normalized.includes('homeexchange')) return 'HomeExchange';
  if (normalized.includes('virement')) return 'Virement';
  if (normalized.includes('especes')) return 'Espèces';
  if (normalized.includes('cheque')) return 'Chèque';
  return 'A définir';
}

function inferGuestName(value, type) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (normalizeText(type) === 'airbnb') return 'Réservation Airbnb';
  return 'Réservation';
}

function createEmptySummary() {
  return {
    inserted: 0,
    updated: 0,
    skipped: {
      duplicate: 0,
      invalid: 0,
      outsideYear: 0,
      unknown: 0
    },
    perGite: {},
    insertedItems: []
  };
}

export function createContratsIntegration({
  baseUrl,
  apiToken,
  basicPassword,
  basicUser = 'what-today',
  explicitGiteMap,
  getExplicitGiteMap,
  gites = [],
  fetchFn,
  logger = console
}) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  const enabled = Boolean(normalizedBaseUrl);
  const requestHeaders = createRequestHeaders({ apiToken, basicPassword, basicUser });
  const staticExplicitMap = parseExplicitMap(explicitGiteMap);
  const explicitMapProvider = typeof getExplicitGiteMap === 'function' ? getExplicitGiteMap : null;
  const knownGites = Array.isArray(gites) ? gites : [];
  const knownGitesByAliasId = new Map(knownGites.map(gite => [gite.id, gite]));

  let gitesCache = null;
  let gitesCacheAt = 0;

  async function requestJson(pathname, { method = 'GET', body } = {}) {
    if (!enabled) {
      throw new Error('Contrats integration is not configured');
    }

    const url = `${normalizedBaseUrl}${pathname}`;
    const response = await fetchFn(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...requestHeaders
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      const message = extractErrorMessage(payload, response.status);
      throw new Error(`Contrats API ${method} ${pathname} failed: ${message}`);
    }

    return payload;
  }

  async function fetchContratsGites({ force = false } = {}) {
    const now = Date.now();
    if (!force && gitesCache && now - gitesCacheAt < GITES_CACHE_TTL_MS) {
      return gitesCache;
    }

    const response = await requestJson('/api/gites');
    const list = Array.isArray(response) ? response : [];
    gitesCache = list;
    gitesCacheAt = now;
    return list;
  }

  function matchAliasToContratsGite(aliasEntry, contratsGites, explicitMap) {
    const aliasId = aliasEntry.id;
    const aliasName = aliasEntry.nom || aliasEntry.name || aliasId;
    const explicitValue = explicitMap[aliasId];

    if (explicitValue) {
      const byId = contratsGites.find(gite => String(gite.id) === explicitValue);
      if (byId) return byId;
      const byPrefix = contratsGites.find(
        gite => normalizeText(gite.prefixe_contrat) === normalizeText(explicitValue)
      );
      if (byPrefix) return byPrefix;
    }

    const aliasNameNormalized = normalizeText(aliasName);
    const exactByName = contratsGites.find(gite => normalizeText(gite.nom) === aliasNameNormalized);
    if (exactByName) return exactByName;

    const containsByName = contratsGites.find((gite) => {
      const giteName = normalizeText(gite.nom);
      return giteName.includes(aliasNameNormalized) || aliasNameNormalized.includes(giteName);
    });
    if (containsByName) return containsByName;

    const byPrefixAliasId = contratsGites.find(
      gite => normalizeText(gite.prefixe_contrat) === normalizeText(aliasId)
    );
    if (byPrefixAliasId) return byPrefixAliasId;

    return null;
  }

  async function getGiteMappings({ force = false } = {}) {
    const contratsGites = await fetchContratsGites({ force });
    const runtimeExplicitMap = parseExplicitMap(explicitMapProvider ? explicitMapProvider() : {});
    const explicitMap = {
      ...staticExplicitMap,
      ...runtimeExplicitMap
    };
    const aliasToContratsId = new Map();
    const contratsToAliasId = new Map();
    const unresolved = [];

    for (const gite of knownGites) {
      const matched = matchAliasToContratsGite(gite, contratsGites, explicitMap);
      if (!matched) {
        unresolved.push(gite.id);
        continue;
      }
      aliasToContratsId.set(gite.id, matched.id);
      contratsToAliasId.set(matched.id, gite.id);
    }

    const mappings = {
      aliasToContratsId,
      contratsToAliasId,
      unresolved
    };

    if (unresolved.length > 0) {
      logger.warn(
        'Contrats integration: unresolved gite mapping for',
        unresolved.join(', ')
      );
    }

    return mappings;
  }

  async function listContratsGites() {
    const rows = await fetchContratsGites();
    return rows.map(gite => ({
      id: gite.id,
      nom: gite.nom,
      prefixe_contrat: gite.prefixe_contrat || ''
    }));
  }

  function resolveAliasFromListingName(listingName) {
    const normalized = normalizeText(listingName);
    if (!normalized) return null;
    const direct = knownGites.find(gite => normalizeText(gite.nom || gite.name) === normalized);
    if (direct) return direct.id;

    const fuzzy = knownGites.find((gite) => {
      const giteName = normalizeText(gite.nom || gite.name);
      return normalized.includes(giteName) || giteName.includes(normalized);
    });
    return fuzzy ? fuzzy.id : null;
  }

  async function listReservationsByYears(years, { contratsGiteId } = {}) {
    const dedup = new Map();
    const validYears = Array.from(new Set((years || []).filter(year => Number.isFinite(year)))).sort();
    await Promise.all(
      validYears.map(async (year) => {
        const params = new URLSearchParams({ year: String(year) });
        if (contratsGiteId) params.set('giteId', String(contratsGiteId));
        const rows = await requestJson(`/api/reservations?${params.toString()}`);
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
          if (!row || typeof row !== 'object' || !row.id) continue;
          dedup.set(row.id, row);
        }
      })
    );
    return Array.from(dedup.values());
  }

  function buildExistingIndex(aliasId, rows) {
    const index = new Map();
    for (const row of rows) {
      const checkIn = toIsoDate(row.date_entree);
      const checkOut = toIsoDate(row.date_sortie);
      if (!checkIn || !checkOut) continue;
      index.set(`${aliasId}|${checkIn}|${checkOut}`, row);
    }
    return index;
  }

  function yearsFromRange(startIso, endIso) {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    if (!start || !end) return [];
    const years = [];
    for (let year = start.year(); year <= end.year(); year += 1) {
      years.push(year);
    }
    return years;
  }

  function yearsFromReservations(items) {
    const years = new Set();
    for (const item of items || []) {
      const start = parseIsoDate(item.checkIn);
      const end = parseIsoDate(item.checkOut);
      if (start) years.add(start.year());
      if (end) years.add(end.year());
    }
    return Array.from(years).sort();
  }

  async function saveManualReservation(payload) {
    const mappings = await getGiteMappings();
    const contratsGiteId = mappings.aliasToContratsId.get(payload.giteId);
    if (!contratsGiteId) {
      throw new Error(`No contrats mapping for gite ${payload.giteId}`);
    }

    const start = parseFrDate(payload.start);
    const end = parseFrDate(payload.end);
    if (!start || !end || !end.isAfter(start, 'day')) {
      throw new Error('Invalid reservation period');
    }

    const nights = Math.max(end.diff(start, 'day'), 1);
    const nightlyPrice = typeof payload.price === 'number' ? payload.price : 0;
    const totalPrice = round2(nightlyPrice * nights);
    const summary = typeof payload.summary === 'string' ? payload.summary.replace(/\n/g, ' ').trim() : '';
    const guestName = inferGuestName(payload.name, 'personal');
    const adults = parseAdultsFromText(summary);

    await requestJson('/api/reservations', {
      method: 'POST',
      body: {
        gite_id: contratsGiteId,
        hote_nom: guestName,
        date_entree: start.format(DATE_ISO_FORMAT),
        date_sortie: end.format(DATE_ISO_FORMAT),
        nb_adultes: adults,
        prix_total: totalPrice,
        price_driver: 'total',
        source_paiement: 'A définir',
        commentaire: summary,
        frais_optionnels_montant: 0,
        frais_optionnels_declares: false,
        options: {}
      }
    });
  }

  async function fetchCommentsRange(startIso, endIso) {
    const mappings = await getGiteMappings();
    const years = yearsFromRange(startIso, endIso);
    if (years.length === 0) return {};

    const rows = await listReservationsByYears(years);
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    const result = {};

    for (const row of rows) {
      const aliasId = mappings.contratsToAliasId.get(row.gite_id);
      if (!aliasId) continue;
      const checkIn = toIsoDate(row.date_entree);
      if (!checkIn) continue;
      const d = parseIsoDate(checkIn);
      if (!d) continue;
      if (d.isBefore(start, 'day') || d.isAfter(end, 'day')) continue;
      const comment = typeof row.commentaire === 'string' ? row.commentaire : '';
      const phone = extractPhone(comment);
      result[`${aliasId}_${checkIn}`] = {
        comment,
        phone
      };
    }

    return result;
  }

  async function fetchSingleComment(giteId, isoDate) {
    const mappings = await getGiteMappings();
    const contratsGiteId = mappings.aliasToContratsId.get(giteId);
    if (!contratsGiteId) {
      return { comment: 'pas de commentaires', phone: '' };
    }

    const date = parseIsoDate(isoDate);
    if (!date) {
      return { comment: 'pas de commentaires', phone: '' };
    }

    const rows = await listReservationsByYears([date.year()], { contratsGiteId });
    const found = rows.find(row => toIsoDate(row.date_entree) === isoDate);
    if (!found) {
      return { comment: 'pas de commentaires', phone: '' };
    }

    const comment = typeof found.commentaire === 'string' ? found.commentaire : '';
    return {
      comment: comment || 'pas de commentaires',
      phone: extractPhone(comment)
    };
  }

  async function listAvailabilityReservations({ years } = {}) {
    const mappings = await getGiteMappings();
    const requestedYears = Array.isArray(years) && years.length > 0
      ? years
      : [dayjs().year(), dayjs().add(1, 'year').year()];
    const rows = await listReservationsByYears(requestedYears);
    const mapped = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      const aliasId = mappings.contratsToAliasId.get(row.gite_id);
      if (!aliasId) continue;

      const checkIn = toIsoDate(row.date_entree);
      const checkOut = toIsoDate(row.date_sortie);
      const checkInDate = parseIsoDate(checkIn);
      const checkOutDate = parseIsoDate(checkOut);

      if (!checkInDate || !checkOutDate || !checkOutDate.isAfter(checkInDate, 'day')) continue;

      const localGite = knownGitesByAliasId.get(aliasId);
      const fallbackName = typeof row?.gite?.nom === 'string' && row.gite.nom.trim()
        ? row.gite.nom.trim()
        : aliasId;

      mapped.push({
        giteId: aliasId,
        giteNom: localGite?.nom || fallbackName,
        couleur: localGite?.couleur || '',
        source: normalizeSourceLabel(row.source_paiement) || 'A définir',
        debut: checkIn,
        fin: checkOut,
        resume: typeof row.hote_nom === 'string' ? row.hote_nom : 'Réservation',
        airbnbUrl: ''
      });
    }

    return mapped;
  }

  async function buildPreviewResponse(flatReservations) {
    const mappings = await getGiteMappings();
    const years = yearsFromReservations(flatReservations);
    const requestedAliases = Array.from(new Set(flatReservations.map(item => item.giteId).filter(Boolean)));
    const existingByAlias = new Map();

    await Promise.all(
      requestedAliases.map(async (aliasId) => {
        const contratsGiteId = mappings.aliasToContratsId.get(aliasId);
        if (!contratsGiteId) {
          existingByAlias.set(aliasId, new Map());
          return;
        }
        const rows = await listReservationsByYears(years, { contratsGiteId });
        existingByAlias.set(aliasId, buildExistingIndex(aliasId, rows));
      })
    );

    const counts = {
      total: flatReservations.length,
      new: 0,
      existing: 0,
      priceMissing: 0,
      commentMissing: 0,
      nameMissing: 0,
      priceCommentMissing: 0,
      outsideYear: 0,
      invalid: 0,
      unknown: 0
    };
    const byGite = {};

    const reservations = flatReservations.map((reservation, index) => {
      const checkIn = parseIsoDate(reservation.checkIn);
      const checkOut = parseIsoDate(reservation.checkOut);
      const aliasId = reservation.giteId || null;
      let status = 'new';
      let reason = '';
      let priceMissing = false;
      let commentMissing = false;
      let nameMissing = false;
      let existingReservationId = null;

      const hasComment = typeof reservation.comment === 'string' && reservation.comment.trim() !== '';
      const hasName = typeof reservation.name === 'string' && reservation.name.trim() !== '';

      if (!aliasId || !mappings.aliasToContratsId.has(aliasId)) {
        status = 'unknown';
        reason = 'gite inconnu';
        counts.unknown += 1;
      } else if (!checkIn || !checkOut || !checkOut.isAfter(checkIn, 'day')) {
        status = 'invalid';
        reason = 'dates invalides';
        counts.invalid += 1;
      } else if (!overlapsCurrentYear(reservation.checkIn, reservation.checkOut)) {
        status = 'outside_year';
        reason = 'hors année';
        counts.outsideYear += 1;
      } else {
        const key = `${aliasId}|${reservation.checkIn}|${reservation.checkOut}`;
        const existing = existingByAlias.get(aliasId)?.get(key) || null;

        if (existing) {
          existingReservationId = existing.id;
          const existingPrixTotal = Number(existing.prix_total);
          const existingPrixNuit = Number(existing.prix_par_nuit);
          const hasPrice = Number.isFinite(existingPrixTotal) && existingPrixTotal > 0
            && Number.isFinite(existingPrixNuit) && existingPrixNuit > 0;
          priceMissing = reservation.type === 'airbnb'
            && typeof reservation.payout === 'number'
            && !hasPrice;
          commentMissing = hasComment && isEmptyValue(existing.commentaire);
          nameMissing = hasName && isEmptyValue(existing.hote_nom);

          if (priceMissing || commentMissing || nameMissing) {
            if (priceMissing && commentMissing) {
              status = 'price_comment_missing';
            } else if (priceMissing) {
              status = 'price_missing';
            } else if (commentMissing) {
              status = 'comment_missing';
            } else {
              status = 'name_missing';
            }

            const missing = [];
            if (priceMissing) missing.push('prix');
            if (commentMissing) missing.push('commentaire');
            if (nameMissing) missing.push('nom');
            reason = `${missing.join(' et ')} manquant${missing.length > 1 ? 's' : ''} dans la base`;

            if (priceMissing) counts.priceMissing += 1;
            if (commentMissing) counts.commentMissing += 1;
            if (nameMissing) counts.nameMissing += 1;
            if (priceMissing && commentMissing) counts.priceCommentMissing += 1;
          } else {
            status = 'existing';
            reason = 'déjà présent';
            counts.existing += 1;
          }
        } else {
          counts.new += 1;
        }
      }

      if (reservation.giteName) {
        if (!byGite[reservation.giteName]) {
          byGite[reservation.giteName] = {
            total: 0,
            new: 0,
            existing: 0,
            priceMissing: 0,
            commentMissing: 0,
            nameMissing: 0,
            priceCommentMissing: 0,
            outsideYear: 0,
            invalid: 0,
            unknown: 0
          };
        }
        byGite[reservation.giteName].total += 1;
        if (status === 'new') byGite[reservation.giteName].new += 1;
        if (status === 'existing') byGite[reservation.giteName].existing += 1;
        if (priceMissing) byGite[reservation.giteName].priceMissing += 1;
        if (commentMissing) byGite[reservation.giteName].commentMissing += 1;
        if (nameMissing) byGite[reservation.giteName].nameMissing += 1;
        if (priceMissing && commentMissing) byGite[reservation.giteName].priceCommentMissing += 1;
        if (status === 'outside_year') byGite[reservation.giteName].outsideYear += 1;
        if (status === 'invalid') byGite[reservation.giteName].invalid += 1;
        if (status === 'unknown') byGite[reservation.giteName].unknown += 1;
      }

      const idRaw = `${aliasId || 'unknown'}|${reservation.checkIn}|${reservation.checkOut}|${reservation.name || ''}|${reservation.type || ''}|${index}`;
      const id = crypto.createHash('sha1').update(idRaw).digest('hex').slice(0, 12);

      return {
        id,
        ...reservation,
        status,
        reason,
        priceMissing,
        commentMissing,
        nameMissing,
        existingReservationId
      };
    });

    return { reservations, counts, byGite };
  }

  function buildReservationWritePayload(item, { contratsGiteId, defaultAdults = 0, fallbackFrom }) {
    const checkIn = item.checkIn;
    const checkOut = item.checkOut;
    const comment = typeof item.comment === 'string' ? item.comment.trim() : '';
    const payout = typeof item.payout === 'number' ? round2(item.payout) : null;
    const total = payout != null ? payout : 0;
    const adults = Math.max(parseAdultsFromText(comment), defaultAdults);

    return {
      gite_id: contratsGiteId,
      hote_nom: inferGuestName(item.name || fallbackFrom?.hote_nom, item.type),
      date_entree: checkIn,
      date_sortie: checkOut,
      nb_adultes: Number.isFinite(fallbackFrom?.nb_adultes)
        ? fallbackFrom.nb_adultes
        : adults,
      prix_total: total,
      price_driver: 'total',
      source_paiement: toContratsSource(item.source, item.type),
      commentaire: comment || (typeof fallbackFrom?.commentaire === 'string' ? fallbackFrom.commentaire : ''),
      frais_optionnels_montant: Number.isFinite(fallbackFrom?.frais_optionnels_montant)
        ? fallbackFrom.frais_optionnels_montant
        : 0,
      frais_optionnels_libelle: fallbackFrom?.frais_optionnels_libelle || null,
      frais_optionnels_declares: Boolean(fallbackFrom?.frais_optionnels_declares),
      options: fallbackFrom?.options || {}
    };
  }

  async function importReservations(incomingReservations, options = {}) {
    const { allowCommentUpdate = true } = options;
    const summary = createEmptySummary();

    if (!Array.isArray(incomingReservations) || incomingReservations.length === 0) {
      return summary;
    }

    const mappings = await getGiteMappings();
    const years = yearsFromReservations(incomingReservations);
    const aliasSet = new Set();

    for (const item of incomingReservations) {
      const aliasId = item.giteId || resolveAliasFromListingName(item.giteName || item.listingName);
      if (aliasId) aliasSet.add(aliasId);
    }

    const existingByAlias = new Map();
    await Promise.all(
      Array.from(aliasSet).map(async (aliasId) => {
        const contratsGiteId = mappings.aliasToContratsId.get(aliasId);
        if (!contratsGiteId) {
          existingByAlias.set(aliasId, new Map());
          return;
        }
        const rows = await listReservationsByYears(years, { contratsGiteId });
        existingByAlias.set(aliasId, buildExistingIndex(aliasId, rows));
      })
    );

    for (const item of incomingReservations) {
      const aliasId = item.giteId || resolveAliasFromListingName(item.giteName || item.listingName);
      const giteLabel = aliasId || item.giteName || item.listingName || 'unknown';
      const contratsGiteId = aliasId ? mappings.aliasToContratsId.get(aliasId) : null;

      if (!aliasId || !contratsGiteId) {
        summary.skipped.unknown += 1;
        continue;
      }

      const start = parseIsoDate(item.checkIn);
      const end = parseIsoDate(item.checkOut);
      if (!start || !end || !end.isAfter(start, 'day')) {
        summary.skipped.invalid += 1;
        continue;
      }
      if (!overlapsCurrentYear(item.checkIn, item.checkOut)) {
        summary.skipped.outsideYear += 1;
        continue;
      }

      const key = `${aliasId}|${item.checkIn}|${item.checkOut}`;
      const aliasIndex = existingByAlias.get(aliasId) || new Map();
      const existing = aliasIndex.get(key) || null;

      if (existing) {
        const hasIncomingComment = typeof item.comment === 'string' && item.comment.trim() !== '';
        const hasIncomingName = typeof item.name === 'string' && item.name.trim() !== '';
        const shouldUpdateComment = allowCommentUpdate && hasIncomingComment && isEmptyValue(existing.commentaire);
        const shouldUpdateName = hasIncomingName && isEmptyValue(existing.hote_nom);
        const shouldUpdatePrice = typeof item.payout === 'number'
          && (!Number.isFinite(Number(existing.prix_total)) || Number(existing.prix_total) <= 0);

        if (!shouldUpdateComment && !shouldUpdateName && !shouldUpdatePrice) {
          summary.skipped.duplicate += 1;
          continue;
        }

        const payload = buildReservationWritePayload(item, {
          contratsGiteId,
          fallbackFrom: existing
        });
        if (!shouldUpdateComment && typeof existing.commentaire === 'string') {
          payload.commentaire = existing.commentaire;
        }
        if (!shouldUpdateName && typeof existing.hote_nom === 'string') {
          payload.hote_nom = existing.hote_nom;
        }
        if (!shouldUpdatePrice) {
          payload.prix_total = Number.isFinite(Number(existing.prix_total))
            ? Number(existing.prix_total)
            : 0;
        }

        await requestJson(`/api/reservations/${existing.id}`, {
          method: 'PUT',
          body: payload
        });

        summary.updated += 1;
        aliasIndex.set(key, {
          ...existing,
          ...payload,
          id: existing.id
        });
        continue;
      }

      const payload = buildReservationWritePayload(item, {
        contratsGiteId,
        defaultAdults: aliasId === 'liberte' ? 10 : 2
      });

      const created = await requestJson('/api/reservations', {
        method: 'POST',
        body: payload
      });

      summary.inserted += 1;
      if (!summary.perGite[giteLabel]) summary.perGite[giteLabel] = 0;
      summary.perGite[giteLabel] += 1;
      summary.insertedItems.push({
        giteId: aliasId,
        giteName: item.giteName || item.listingName || aliasId,
        source: normalizeSourceLabel(item.source),
        type: item.type || '',
        checkIn: item.checkIn,
        checkOut: item.checkOut
      });

      aliasIndex.set(key, {
        id: created?.id || `${key}|created`,
        ...payload
      });
      existingByAlias.set(aliasId, aliasIndex);
    }

    return summary;
  }

  return {
    enabled,
    listContratsGites,
    listAvailabilityReservations,
    saveManualReservation,
    fetchCommentsRange,
    fetchSingleComment,
    buildPreviewResponse,
    importReservations
  };
}
