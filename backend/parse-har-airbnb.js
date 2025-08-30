// parse-har-airbnb.js
// Usage: node parse-har-airbnb.js <input.har> [outputDir]
/*
Sortie unique: reservations_by_listing.json
- Gîtes autorisés & mapping:
    16674752 -> "Gree"
    48504640 -> "Liberté"
    6668903  -> "Phonsine"
    43504621 -> "Edmond"
- Airbnb fusion par confirmationCode (dates, guests, payout num)
- Notes perso regroupées par gîte & commentaire EXACT sur jours contigus
- Champs conservés par réservation:
    { type, checkIn, checkOut, nights, name, payout, comment }
*/

const fs = require("fs");
const path = require("path");

// ---- mapping des gîtes (ids -> nom)
const ALLOWED_LISTINGS = new Map([
  ["16674752", "Gree"],
  ["48504640", "Liberté"],
  ["6668903",  "Phonsine"],
  ["43504621", "Edmond"],
]);

const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const safeGet = (obj, pathArr) =>
  pathArr.reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);

function addDaysISO(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function diffDaysISO(a, bExclusive) {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(bExclusive + "T00:00:00Z");
  return Math.round((db - da) / 86400000);
}
function computeContiguousRanges(sortedDates) {
  if (sortedDates.length === 0) return [];
  const ranges = [];
  let start = sortedDates[0];
  let prev = sortedDates[0];
  for (let i = 1; i < sortedDates.length; i++) {
    const d = sortedDates[i];
    const expectedNext = addDaysISO(prev, 1);
    if (d !== expectedNext) {
      ranges.push([start, prev]);
      start = d;
    }
    prev = d;
  }
  ranges.push([start, prev]);
  return ranges;
}

// Convertit "250,75 €" -> 250.75 (nombre)
function toNumberPayout(s) {
  if (s == null) return null;
  const raw = String(s)
    .replace(/\u00A0/g, " ")     // espaces insécables
    .replace(/[^\d,.\-]/g, "")   // garde chiffres, signes, séparateurs
    .trim();

  // Si virgule comme décimale (format FR)
  if (/,/.test(raw) && !/\.\d{1,2}$/.test(raw)) {
    // remplace le dernier séparateur ',' par '.' et vire autres séparateurs
    const lastComma = raw.lastIndexOf(",");
    const head = raw.slice(0, lastComma).replace(/[.,\s]/g, "");
    const tail = raw.slice(lastComma + 1);
    const num = `${head}.${tail}`;
    const n = Number(num);
    return Number.isFinite(n) ? n : null;
  }

  // Sinon parse normal en virant séparateurs de milliers
  const n = Number(raw.replace(/[\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ---------- HAR parsing robuste ----------
function decodeContentText(content) {
  if (!content || content.text == null) return null;
  if (content.encoding === "base64") {
    try {
      return Buffer.from(content.text, "base64").toString("utf-8");
    } catch {
      return null;
    }
  }
  return content.text;
}
function parseJsonLikeFromContent(content) {
  const raw = decodeContentText(content);
  if (!raw) return null;
  const mt = String(content.mimeType || "").toLowerCase();
  const looksJson = mt.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");
  if (!looksJson) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

// ---------- extraction ----------
function extractBlocksFromEntry(entry) {
  const out = [];
  const data = parseJsonLikeFromContent(entry?.response?.content);
  if (!data) return out;

  const patek = data?.data?.patek;
  if (!patek || typeof patek !== "object") return out;

  // 1) AdditionalReservationData -> payout/statut/code
  const resResources = safeGet(patek, ["getAdditionalReservationData", "reservationResources"]);
  if (Array.isArray(resResources)) {
    for (const r of resResources) {
      out.push({
        kind: "additional",
        confirmationCode: r?.confirmationCode || null,
        status: r?.hostFacingStatus || null,
        payout: r?.hostPayoutFormatted || null,
      });
    }
  }

  // 2) MultiCalendar -> reservations Airbnb + notes perso
  const calendars = safeGet(patek, [
    "getMultiCalendarListingsAndCalendars",
    "hostCalendarsResponse",
    "calendars",
  ]);

  if (Array.isArray(calendars)) {
    for (const cal of calendars) {
      const listingIdRaw = cal?.listingId != null ? String(cal.listingId) : "";
      // Cas spécial: agréger les réservations Airbnb du listing 1256595615494549883 dans "Gree"
      const SPECIAL_MERGE_TO_GREE = "1256595615494549883";
      let listingName = null;
      let onlyAirbnbForThisListing = false;
      if (ALLOWED_LISTINGS.has(listingIdRaw)) {
        listingName = ALLOWED_LISTINGS.get(listingIdRaw);
      } else if (listingIdRaw === SPECIAL_MERGE_TO_GREE) {
        listingName = "Gree";
        onlyAirbnbForThisListing = true; // n'inclure que les réservations Airbnb (pas les notes)
      } else {
        continue; // ignorer gîtes non listés
      }

      const days = toArray(cal?.days);
      for (const day of days) {
        const date = day?.date || day?.day || null; // <- clé "day" ou "date"

        // Airbnb reservation (jour occupé avec un objet reservation)
        const resa = (day?.unavailabilityReasons || {})?.reservation || null;
        if (date && resa && resa.confirmationCode) {
          const guest = resa?.guestInfo || {};
          out.push({
            kind: "calendar",
            listingName,                 // on stocke directement le nom
            date,
            confirmationCode: resa.confirmationCode,
            guestFirstName: guest.firstName || null,
            guestLastName: guest.lastName || null,
            numberOfGuests: resa.numberOfGuests ?? null,
          });
        }

        // Notes perso (commentaire intact)
        const noteCandidates = [day?.notes, day?.note, day?.dayNotes, day?.hostNotes];
        const comment = noteCandidates.find((v) => typeof v === "string" && v.trim().length > 0);
        if (date && comment && !onlyAirbnbForThisListing) {
          out.push({
            kind: "note",
            listingName,
            date,
            comment,
          });
        }
      }
    }
  }

  return out;
}

// ---------- fusion Airbnb ----------
function fuseAirbnbByConfirmation(rawRecords) {
  const idx = new Map(); // confirmationCode -> agg

  for (const rec of rawRecords) {
    if (!rec.confirmationCode) continue;
    if (!idx.has(rec.confirmationCode)) {
      idx.set(rec.confirmationCode, {
        listingName: null,
        dates: new Set(),
        guestFirstName: null,
        guestLastName: null,
        numberOfGuests: null,
        status: null,
        payoutRaw: null,
      });
    }
    const agg = idx.get(rec.confirmationCode);

    if (rec.kind === "calendar") {
      if (!agg.listingName && rec.listingName) agg.listingName = rec.listingName;
      if (rec.date) agg.dates.add(rec.date);
      if (!agg.guestFirstName && rec.guestFirstName) agg.guestFirstName = rec.guestFirstName;
      if (!agg.guestLastName && rec.guestLastName) agg.guestLastName = rec.guestLastName;
      if (typeof rec.numberOfGuests === "number") {
        agg.numberOfGuests =
          typeof agg.numberOfGuests === "number"
            ? Math.max(agg.numberOfGuests, rec.numberOfGuests)
            : rec.numberOfGuests;
      }
    }
    if (rec.kind === "additional") {
      if (rec.status) agg.status = rec.status;
      if (rec.payout) agg.payoutRaw = rec.payout;
    }
  }

  const fused = [];
  for (const [code, agg] of idx.entries()) {
    if (!agg.listingName) continue; // sécurité (on ignore si hors mapping)
    const dates = Array.from(agg.dates).sort();
    const checkIn = dates[0] || null;
    const checkOut = dates.length ? addDaysISO(dates[dates.length - 1], 1) : null;

    fused.push({
      type: "airbnb",
      listingName: agg.listingName,
      checkIn,
      checkOut,
      nights: dates.length || null,
      guestFirstName: agg.guestFirstName,
      guestLastName: agg.guestLastName,
      payout: toNumberPayout(agg.payoutRaw), // nombre
      comment: null,
    });
  }
  return fused;
}

// ---------- fusion Notes perso ----------
function fusePersonalNotes(rawRecords) {
  // groupe par (listingName, comment EXACT) puis condense en plages contiguës
  const bucket = new Map(); // key = `${listingName}||${comment}` -> Set(dates)
  const rawNotes = rawRecords.filter(
    (r) => r.kind === "note" && r.listingName && r.date && typeof r.comment === "string"
  );
  for (const n of rawNotes) {
    const key = `${n.listingName}||${n.comment}`;
    if (!bucket.has(key)) bucket.set(key, { listingName: n.listingName, comment: n.comment, dates: new Set() });
    bucket.get(key).dates.add(n.date);
  }

  const results = [];
  for (const entry of bucket.values()) {
    const dates = Array.from(entry.dates).sort();
    const ranges = computeContiguousRanges(dates);
    for (const [start, end] of ranges) {
      const checkIn = start;
      const checkOut = addDaysISO(end, 1);
      const nights = diffDaysISO(checkIn, checkOut);

      results.push({
        type: "personal",
        listingName: entry.listingName,
        checkIn,
        checkOut,
        nights,
        guestFirstName: null,
        guestLastName: null,
        payout: null,
        comment: entry.comment, // TEXTE INTÉGRAL
      });
    }
  }
  return results;
}

// ---------- main ----------
function main() {
  const [,, inHar, outDirArg] = process.argv;
  if (!inHar) {
    console.error("Usage: node parse-har-airbnb.js <input.har> [outputDir]");
    process.exit(1);
  }
  const outDir = path.resolve(outDirArg || process.cwd());
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const har = JSON.parse(fs.readFileSync(inHar, "utf-8"));
  const entries = har?.log?.entries || [];

  const collected = [];
  for (const entry of entries) {
    collected.push(...extractBlocksFromEntry(entry));
  }

  // séparer & fusionner
  const airbnbRaw = collected.filter((r) => r.kind === "calendar" || r.kind === "additional");
  const personalRaw = collected.filter((r) => r.kind === "note");

  const airbnb = fuseAirbnbByConfirmation(airbnbRaw);
  const personal = fusePersonalNotes(personalRaw);

  // combine puis regroupe par nom de gîte
  const all = [...airbnb, ...personal];
  // logs des volumes par type
  console.log(`📊 Réservations Airbnb: ${airbnb.length}`);
  console.log(`📘 Réservations perso: ${personal.length}`);
  const byListingName = {};
  const fullName = (first, last) => {
    const clean = (s) => (typeof s === "string" ? s.trim() : s);
    const name = [clean(first), clean(last)].filter(Boolean).join(" ");
    return name || null;
  };
  const cleanComment = (c) => {
    if (typeof c !== "string") return c ?? null;
    return c.replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim() || null;
  };
  for (const r of all) {
    const key = r.listingName;
    if (!key || !ALLOWED_LISTINGS.has([...ALLOWED_LISTINGS.entries()].find(([,name]) => name === key)?.[0] || "")) {
      continue; // ignorer tout ce qui ne correspond pas aux 4 gîtes
    }
    if (!byListingName[key]) byListingName[key] = [];
    // supprimer les champs non demandés (ils n'existent déjà plus)
    byListingName[key].push({
      type: r.type,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      name: fullName(r.guestFirstName, r.guestLastName),
      payout: r.payout != null ? r.payout : null,
      comment: cleanComment(r.comment),
    });
  }

  // tri par date dans chaque gîte
  for (const k of Object.keys(byListingName)) {
    byListingName[k].sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
  }

  // retire la première ET la dernière entrée de chaque gîte (après tri)
  for (const k of Object.keys(byListingName)) {
    const arr = byListingName[k];
    if (!Array.isArray(arr)) continue;
    if (arr.length > 1) byListingName[k] = arr.slice(1, -1);
    else byListingName[k] = [];
  }

  const outFile = path.join(outDir, "reservations_by_listing.json");
  fs.writeFileSync(outFile, JSON.stringify(byListingName, null, 2), "utf-8");

  console.log(`✅ Écrit → ${outFile}`);
}

if (require.main === module) {
  main();
}
