import fs from 'fs';
import crypto from 'crypto';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterMs(res) {
  const value = res.headers.get('retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, seconds * 1000);
}

function isRetryableWriteStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createSheetsClient({
  spreadsheetId,
  credentialsPath,
  fetchFn,
  writeThrottleMs,
  writeRetryLimit,
  writeBackoffBaseMs,
  writeBackoffMaxMs
}) {
  let lastWriteAt = 0;

  async function throttleWrite() {
    const now = Date.now();
    const waitMs = lastWriteAt + writeThrottleMs - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastWriteAt = Date.now();
  }

  async function requestWrite(url, options, { expectJson = true } = {}) {
    let attempt = 0;
    let delayMs = 0;
    while (attempt <= writeRetryLimit) {
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      await throttleWrite();
      const res = await fetchFn(url, options);
      if (res.ok) {
        return expectJson ? res.json() : res.text();
      }

      const bodyText = await res.text().catch(() => '');
      if (!isRetryableWriteStatus(res.status) || attempt === writeRetryLimit) {
        throw new Error(`Sheets write error ${res.status}: ${bodyText}`);
      }

      const retryAfterMs = parseRetryAfterMs(res);
      const backoff = Math.min(writeBackoffBaseMs * (2 ** attempt), writeBackoffMaxMs);
      const jitter = Math.floor(Math.random() * 200);
      delayMs = Math.max(backoff + jitter, retryAfterMs);
      attempt += 1;
    }
    throw new Error('Sheets write error: retry limit exceeded');
  }

  async function getAccessToken() {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64url(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
      })
    );
    const unsigned = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    const signature = base64url(sign.sign(creds.private_key));
    const jwt = `${unsigned}.${signature}`;

    const res = await fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Token request failed');
    return data.access_token;
  }

  async function getSheetId(sheetName, token) {
    const res = await fetchFn(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const sheet = data.sheets.find(s => s.properties.title === sheetName);
    return sheet.properties.sheetId;
  }

  async function fetchSheetValues(range, token) {
    const res = await fetchFn(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sheets values error ${res.status}: ${text}`);
    }
    const data = await res.json();
    return data.values || [];
  }

  return {
    requestWrite,
    getAccessToken,
    getSheetId,
    fetchSheetValues
  };
}
