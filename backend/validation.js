import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const FR_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function ok(value) {
  return { ok: true, value };
}

function fail(error) {
  return { ok: false, error };
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, { max = 255, allowEmpty = true, trim = true } = {}) {
  if (typeof value !== 'string') return null;
  const next = trim ? value.trim() : value;
  if (!allowEmpty && next.length === 0) return null;
  if (next.length > max) return null;
  return next;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return null;
  const parsed = dayjs(value, 'YYYY-MM-DD', true);
  return parsed.isValid() ? parsed : null;
}

function parseFrDate(value) {
  if (typeof value !== 'string' || !FR_DATE_REGEX.test(value)) return null;
  const parsed = dayjs(value, 'DD/MM/YYYY', true);
  return parsed.isValid() ? parsed : null;
}

function sanitizeTheme(theme) {
  if (!isPlainObject(theme)) return null;

  const id = normalizeString(theme.id, { max: 80, allowEmpty: false });
  const name = normalizeString(theme.name, { max: 120, allowEmpty: false });
  if (!id || !name) return null;

  const sanitizeColor = value => normalizeString(value, { max: 32, allowEmpty: false });
  const sanitizeColorObject = (input, allowedKeys) => {
    if (!isPlainObject(input)) return undefined;
    const out = {};
    for (const key of allowedKeys) {
      if (input[key] == null) continue;
      const color = sanitizeColor(input[key]);
      if (!color) return null;
      out[key] = color;
    }
    return out;
  };

  const events = sanitizeColorObject(theme.events, ['arrival', 'depart', 'both', 'done']);
  if (events === null) return null;
  const text = sanitizeColorObject(theme.text, ['primary', 'title', 'caption']);
  if (text === null) return null;
  const menu = sanitizeColorObject(theme.menu, ['bg', 'icon', 'indicator']);
  if (menu === null) return null;

  let panelColors;
  if (theme.panelColors != null) {
    if (!Array.isArray(theme.panelColors) || theme.panelColors.length > 8) return null;
    panelColors = [];
    for (const colorValue of theme.panelColors) {
      const color = sanitizeColor(colorValue);
      if (!color) return null;
      panelColors.push(color);
    }
  }

  const cardBg = theme.cardBg == null ? undefined : sanitizeColor(theme.cardBg);
  if (theme.cardBg != null && !cardBg) return null;
  const ticketBg = theme.ticketBg == null ? undefined : sanitizeColor(theme.ticketBg);
  if (theme.ticketBg != null && !ticketBg) return null;

  return {
    id,
    name,
    ...(events ? { events } : {}),
    ...(text ? { text } : {}),
    ...(menu ? { menu } : {}),
    ...(panelColors ? { panelColors } : {}),
    ...(cardBg ? { cardBg } : {}),
    ...(ticketBg ? { ticketBg } : {})
  };
}

export function validateDateRangeQuery(start, end, { maxDays = 366 } = {}) {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) {
    return fail('Dates must use YYYY-MM-DD format');
  }
  if (endDate.isBefore(startDate, 'day')) {
    return fail('End date must be greater than or equal to start date');
  }
  if (endDate.diff(startDate, 'day') > maxDays) {
    return fail(`Date range cannot exceed ${maxDays} days`);
  }
  return ok({ start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') });
}

export function validateIsoDateParam(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) return fail('Date must use YYYY-MM-DD format');
  return ok(parsed.format('YYYY-MM-DD'));
}

export function validateStatusUpdatePayload(body) {
  if (!isPlainObject(body)) return fail('Invalid body');
  if (typeof body.done !== 'boolean') return fail('Field "done" must be a boolean');
  if (body.user != null && normalizeString(body.user, { max: 80 }) == null) {
    return fail('Field "user" must be a string up to 80 characters');
  }
  const user = typeof body.user === 'string' ? body.user.trim() : '';
  return ok({ done: body.done, user });
}

export function validatePricesPayload(payload, validGiteIds) {
  if (!Array.isArray(payload)) return fail('Body must be an array');
  if (payload.length > 500) return fail('Too many price entries');

  const prices = [];
  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (!isPlainObject(item)) return fail(`Invalid price entry at index ${i}`);
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
      return fail(`Invalid "amount" at index ${i}`);
    }
    if (!Array.isArray(item.gites)) return fail(`Invalid "gites" at index ${i}`);

    const gites = [];
    for (const giteId of item.gites) {
      const normalized = normalizeString(giteId, { max: 40, allowEmpty: false });
      if (!normalized || !validGiteIds.has(normalized)) {
        return fail(`Unknown gite "${giteId}" in prices`);
      }
      if (!gites.includes(normalized)) gites.push(normalized);
    }

    prices.push({ amount, gites });
  }

  return ok(prices);
}

export function validateTextsPayload(payload) {
  if (!Array.isArray(payload)) return fail('Body must be an array');
  if (payload.length > 500) return fail('Too many text entries');

  const texts = [];
  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (!isPlainObject(item)) return fail(`Invalid text entry at index ${i}`);
    const title = normalizeString(item.title ?? '', { max: 200 });
    const text = normalizeString(item.text ?? '', { max: 5000, trim: false });
    if (title == null || text == null) return fail(`Invalid text entry at index ${i}`);
    texts.push({ title, text });
  }

  return ok(texts);
}

export function validateDataPayload(payload, validGiteIds) {
  if (!isPlainObject(payload)) return fail('Body must be an object');

  const pricesResult = validatePricesPayload(payload.prices ?? [], validGiteIds);
  if (!pricesResult.ok) return pricesResult;

  const textsResult = validateTextsPayload(payload.texts ?? []);
  if (!textsResult.ok) return textsResult;

  if (payload.themes != null && !Array.isArray(payload.themes)) {
    return fail('Field "themes" must be an array');
  }
  const themesInput = Array.isArray(payload.themes) ? payload.themes : [];
  if (themesInput.length > 100) return fail('Too many themes');
  const themes = [];
  for (let i = 0; i < themesInput.length; i++) {
    const sanitized = sanitizeTheme(themesInput[i]);
    if (!sanitized) return fail(`Invalid theme at index ${i}`);
    themes.push(sanitized);
  }

  let activeThemeId = 'default';
  if (payload.activeThemeId != null) {
    const normalized = normalizeString(payload.activeThemeId, { max: 80, allowEmpty: false });
    if (!normalized) return fail('Invalid activeThemeId');
    activeThemeId = normalized;
  }

  let giteMappings = {};
  if (payload.giteMappings != null) {
    if (!isPlainObject(payload.giteMappings)) {
      return fail('Field "giteMappings" must be an object');
    }

    const next = {};
    for (const [rawGiteId, rawContratsId] of Object.entries(payload.giteMappings)) {
      const giteId = normalizeString(rawGiteId, { max: 40, allowEmpty: false });
      if (!giteId || !validGiteIds.has(giteId)) {
        return fail(`Unknown gite "${rawGiteId}" in giteMappings`);
      }

      const contratsId = normalizeString(rawContratsId ?? '', { max: 120, allowEmpty: true });
      if (contratsId == null) {
        return fail(`Invalid contrats gite id for "${giteId}"`);
      }

      next[giteId] = contratsId.trim();
    }

    giteMappings = next;
  }

  return ok({
    prices: pricesResult.value,
    texts: textsResult.value,
    themes,
    activeThemeId,
    giteMappings
  });
}

export function validateSaveReservationPayload(payload, validGiteIds) {
  if (!isPlainObject(payload)) return fail('Invalid body');

  const giteId = normalizeString(payload.giteId, { max: 40, allowEmpty: false });
  if (!giteId || !validGiteIds.has(giteId)) {
    return fail('Invalid gite');
  }

  const startDate = parseFrDate(payload.start);
  const endDate = parseFrDate(payload.end);
  if (!startDate || !endDate) {
    return fail('Fields "start" and "end" must use DD/MM/YYYY format');
  }
  if (!endDate.isAfter(startDate, 'day')) {
    return fail('End date must be after start date');
  }

  const name = normalizeString(payload.name ?? '', { max: 120 }) ?? '';
  const summary = normalizeString(payload.summary ?? '', { max: 2000, trim: false });
  if (summary == null) return fail('Field "summary" is too long');

  let price;
  if (payload.price != null) {
    price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0 || price > 10000000) {
      return fail('Invalid price');
    }
  }

  const phone = normalizeString(payload.phone ?? '', { max: 40 }) ?? '';
  if (!/^[0-9 +().-]*$/.test(phone)) {
    return fail('Invalid phone format');
  }

  return ok({
    giteId,
    name,
    start: startDate.format('DD/MM/YYYY'),
    end: endDate.format('DD/MM/YYYY'),
    summary,
    phone,
    ...(price != null ? { price } : {})
  });
}

export function validateHarImportPayload(payload) {
  if (!isPlainObject(payload)) return fail('Invalid body');
  if (!Array.isArray(payload.reservations)) return fail('Field "reservations" must be an array');
  if (payload.reservations.length === 0) return fail('No reservations provided');
  if (payload.reservations.length > 5000) return fail('Too many reservations');

  const reservations = [];
  for (let i = 0; i < payload.reservations.length; i++) {
    const item = payload.reservations[i];
    if (!isPlainObject(item)) return fail(`Invalid reservation at index ${i}`);

    const checkIn = parseIsoDate(item.checkIn);
    const checkOut = parseIsoDate(item.checkOut);
    if (!checkIn || !checkOut || !checkOut.isAfter(checkIn, 'day')) {
      return fail(`Invalid reservation dates at index ${i}`);
    }

    const type = normalizeString(item.type ?? 'personal', { max: 20 }) || 'personal';
    if (type !== 'airbnb' && type !== 'personal') {
      return fail(`Invalid reservation type at index ${i}`);
    }

    let nights;
    if (item.nights != null) {
      const nightsValue = Number(item.nights);
      if (!Number.isFinite(nightsValue) || nightsValue < 0 || nightsValue > 365) {
        return fail(`Invalid nights at index ${i}`);
      }
      nights = nightsValue;
    }

    let payout;
    if (item.payout != null) {
      const payoutValue = Number(item.payout);
      if (!Number.isFinite(payoutValue) || payoutValue < 0 || payoutValue > 10000000) {
        return fail(`Invalid payout at index ${i}`);
      }
      payout = payoutValue;
    }

    const sanitized = {
      ...(normalizeString(item.id ?? '', { max: 120 }) ? { id: item.id.trim() } : {}),
      ...(normalizeString(item.existingReservationId ?? '', { max: 120 })
        ? { existingReservationId: item.existingReservationId.trim() }
        : {}),
      ...(normalizeString(item.giteId ?? '', { max: 40 }) ? { giteId: item.giteId.trim() } : {}),
      ...(normalizeString(item.giteName ?? '', { max: 120, trim: false }) ? { giteName: item.giteName } : {}),
      ...(normalizeString(item.listingName ?? '', { max: 120, trim: false }) ? { listingName: item.listingName } : {}),
      type,
      checkIn: checkIn.format('YYYY-MM-DD'),
      checkOut: checkOut.format('YYYY-MM-DD'),
      ...(nights != null ? { nights } : {}),
      ...(normalizeString(item.name ?? '', { max: 200, trim: false }) ? { name: item.name } : {}),
      ...(payout != null ? { payout } : {}),
      ...(normalizeString(item.comment ?? '', { max: 2000, trim: false }) ? { comment: item.comment } : {}),
      ...(normalizeString(item.source ?? '', { max: 80, trim: false }) ? { source: item.source } : {})
    };

    reservations.push(sanitized);
  }

  return ok({ reservations });
}

export function validateHarUploadPayload(payload) {
  if (!isPlainObject(payload)) return fail('HAR body must be a JSON object');
  if (!isPlainObject(payload.log) || !Array.isArray(payload.log.entries)) {
    return fail('Invalid HAR format: expected "log.entries" array');
  }
  return ok(payload);
}
