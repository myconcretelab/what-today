const IS_PROD = import.meta.env.PROD;
const API_BASE = IS_PROD ? '' : 'http://localhost:3001';

const ARRIVALS_URL = `${API_BASE}/api/arrivals`;
const STATUS_URL = `${API_BASE}/api/statuses`;
const REFRESH_URL = `${API_BASE}/api/reload-icals`;
export const SAVE_RESERVATION = `${API_BASE}/api/save-reservation`;
const PRICES_URL = `${API_BASE}/api/prices`;
const TEXTS_URL = `${API_BASE}/api/texts`;
const DATA_URL = `${API_BASE}/api/data`;
const CONTRATS_GITES_URL = `${API_BASE}/api/contrats-gites`;
const HOLIDAYS_URL = `${API_BASE}/api/school-holidays`;
const PUBLIC_HOLIDAYS_URL = 'https://calendrier.api.gouv.fr/jours-feries/metropole.json';
const COMMENTS_URL = `${API_BASE}/api/comments-range`;

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRY_DELAY_MS = 400;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toRequestError(message, extras = {}) {
  const error = new Error(message);
  Object.assign(error, extras);
  return error;
}

async function parseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload, status) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  return `HTTP ${status}`;
}

async function requestJson(url, init = {}, options = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const retries = options.retries ?? (method === 'GET' ? 1 : 0);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        method,
        signal: controller.signal
      });
      const payload = await parseBody(response);

      if (!response.ok) {
        const error = toRequestError(extractErrorMessage(payload, response.status), {
          status: response.status,
          url,
          payload
        });

        if (attempt < retries && RETRYABLE_STATUS.has(response.status)) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        throw error;
      }

      return payload;
    } catch (error) {
      const isTimeout = error?.name === 'AbortError';
      const isNetworkError = error instanceof TypeError;

      if (isTimeout) {
        const timeoutError = toRequestError(`Timeout after ${timeoutMs}ms`, {
          code: 'TIMEOUT',
          url
        });
        if (attempt < retries) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        throw timeoutError;
      }

      if (attempt < retries && isNetworkError) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw toRequestError('Network request failed', { url });
}

function postJson(url, payload, options = {}) {
  const hasPayload = payload !== undefined;
  const init = {
    method: 'POST'
  };

  if (hasPayload) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(payload);
  }

  return requestJson(
    url,
    init,
    options
  );
}

export async function fetchArrivals() {
  return requestJson(ARRIVALS_URL);
}

export async function fetchStatuses() {
  return requestJson(STATUS_URL);
}

export async function updateStatus(id, done, user) {
  return postJson(`${STATUS_URL}/${id}`, { done, user });
}

export async function refreshCalendars() {
  return postJson(REFRESH_URL);
}

export async function fetchComments(start, end) {
  const params = new URLSearchParams({ start, end });
  return requestJson(`${COMMENTS_URL}?${params.toString()}`);
}

export async function fetchSchoolHolidays() {
  return requestJson(HOLIDAYS_URL);
}

export async function fetchPublicHolidays() {
  return requestJson(PUBLIC_HOLIDAYS_URL, {}, { retries: 2 });
}

export async function fetchPrices() {
  return requestJson(PRICES_URL);
}

export async function savePrices(data) {
  return postJson(PRICES_URL, data);
}

export async function fetchTexts() {
  return requestJson(TEXTS_URL);
}

export async function saveTexts(data) {
  return postJson(TEXTS_URL, data);
}

export async function fetchData() {
  return requestJson(DATA_URL);
}

export async function saveData(data) {
  return postJson(DATA_URL, data);
}

export async function fetchContratsGites() {
  return requestJson(CONTRATS_GITES_URL);
}
