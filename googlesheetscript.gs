// ================== Source JSON ==================
// Remplacement des flux iCal: on charge désormais un JSON consolidé.
const HAR_JSON_URL = 'https://today.gites-broceliande.com/api/har-calendar';

const YELLOW = '#fff9c4'; // jaune très léger (MD Yellow 100)

// ================== Utils dates & colonnes ==================
function formatDateFR(date) {
  if (!date) return "";
  if (Object.prototype.toString.call(date) === "[object Date]") {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  if (typeof date === "string" && /^\d{8}$/.test(date)) {
    date = icalDateToJS(date);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  if (typeof date === "number") {
    date = new Date(Math.round((date - 25569) * 86400 * 1000));
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  if (typeof date === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
  return "";
}

function icalDateToJS(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return new Date(
    parseInt(yyyymmdd.slice(0, 4), 10),
    parseInt(yyyymmdd.slice(4, 6), 10) - 1,
    parseInt(yyyymmdd.slice(6, 8), 10)
  );
}

function toDateFromCell(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const s = v.trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) { const d = new Date(+m[3], +m[2]-1, +m[1]); return isNaN(d.getTime()) ? null : d; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) { const d = new Date(+m[1], +m[2]-1, +m[3]); return isNaN(d.getTime()) ? null : d; }
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) { const d = new Date(+m[1], +m[2]-1, +m[3]); return isNaN(d.getTime()) ? null : d; }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function ymKey(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

function normalizeColName(s) {
  return (s || "")
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
}

function getColumnIndex(header, col) {
  const target = normalizeColName(col);
  for (let i = 0; i < header.length; i++) {
    if (normalizeColName(header[i]) === target) return i;
  }
  return -1;
}

// Test recouvrement avec l'année courante
function overlapsCurrentYear(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);   // 1 jan
  const yearEnd   = new Date(year, 11, 31); // 31 déc
  // chevauchement si start <= yearEnd && end-1 >= yearStart
  // NB: DTEND iCal est exclusif; on retire 1 jour à end pour tester le chevauchement réel
  const endInclusive = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
  return (startDate <= yearEnd) && (endInclusive >= yearStart);
}

// ================== MAIN (JSON) ==================
function majReservationsJSON() {
  Logger.log("=== DÉBUT SYNCHRO JSON (HAR) ===");
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Récupération du JSON consolidé (par gîte)
  let all;
  try {
    const resp = UrlFetchApp.fetch(HAR_JSON_URL, { muteHttpExceptions: true, followRedirects: true });
    const text = resp.getContentText();
    all = JSON.parse(text);
  } catch (e) {
    Logger.log('❌ Erreur de chargement JSON: ' + e);
    return;
  }

  // Pour chaque feuille (gîte) existante, injecter les réservations correspondantes
  const sheetNames = Object.keys(all);
  for (let idx = 0; idx < sheetNames.length; idx++) {
    const feuilleNom = sheetNames[idx];
    Logger.log("---\nTraitement feuille : " + feuilleNom);
    const sheet = ss.getSheetByName(feuilleNom);
    if (!sheet) {
      Logger.log("❌ Feuille non trouvée : " + feuilleNom);
      continue;
    }

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const iNom = getColumnIndex(header, "Nom");
    const iDebut = getColumnIndex(header, "Debut");
    const iFin = getColumnIndex(header, "Fin");
    // Colonne paiement par nom (si existe) ET colonne I explicitement demandée
    const iPaiement = getColumnIndex(header, "Paiement");
    if (iDebut === -1 || iFin === -1) {
      Logger.log("⚠️ Colonnes Debut/Fin non trouvées dans " + feuilleNom);
      continue;
    }

    // Réservations existantes (pour vérif doublons)
    const data = sheet.getDataRange().getValues();
    const bookingsExistantes = data.slice(1).map(row => ({
      Debut: formatDateFR(row[iDebut]),
      Fin: formatDateFR(row[iFin])
    })).filter(b => b.Debut && b.Fin);

    let totalAjoutes = 0;
    
    // ----- Ajout des réservations depuis le JSON (limitées à l'année courante) -----
    const reservations = Array.isArray(all[feuilleNom]) ? all[feuilleNom] : [];
    for (let i = 0; i < reservations.length; i++) {
      const r = reservations[i];
      // r: { type, checkIn: 'YYYY-MM-DD', checkOut: 'YYYY-MM-DD', nights, name, payout, comment }
      const dStart = toDateFromCell(r.checkIn);
      const dEnd   = toDateFromCell(r.checkOut);
      if (!dStart || !dEnd) continue;
      if (!overlapsCurrentYear(dStart, dEnd)) continue; // filtre année courante (même logique qu'avant)

      const debutStr = formatDateFR(dStart);
      const finStr   = formatDateFR(dEnd);

      // Doublon simple Début + Fin (au format affiché)
      const doublon = bookingsExistantes.some(b => b.Debut === debutStr && b.Fin === finStr);
      if (doublon) continue;

      const row = Array(header.length).fill('');
      // Nom (colonne A attendu) + sécurité par en-tête "Nom"
      if (iNom !== -1) row[iNom] = r.name || '';
      // Dates
      row[iDebut] = debutStr;
      row[iFin]   = finStr;

      // Paiement: colonne par nom si présente
      if (iPaiement !== -1) {
        row[iPaiement] = (r.type === 'airbnb') ? 'Airbnb' : 'A définir';
      }

      // Append initial row
      sheet.appendRow(row);

      // Position réelle de la ligne ajoutée
      const lastRow = sheet.getLastRow();

      // Exigences spécifiques: colonne I (9) = type → "Airbnb" ou "A définir"
      //                        colonne H (8) = payout
      //                        colonne J (10) = comment
      const paiementText = (r.type === 'airbnb') ? 'Airbnb' : 'A définir';
      sheet.getRange(lastRow, 9).setValue(paiementText); // Colonne I
      if (r.payout != null) sheet.getRange(lastRow, 8).setValue(r.payout); // Colonne H
      if (r.comment) sheet.getRange(lastRow, 10).setValue(r.comment); // Colonne J
      if (iNom === -1 && r.name) sheet.getRange(lastRow, 1).setValue(r.name); // Sécurité si pas d'entête "Nom"

      // Recopie automatique des formules pour D, E et F depuis la première ligne au-dessus contenant une formule
      try {
        autoFillFormulasForRow(sheet, lastRow, [4, 5, 6]); // D, E, F
      } catch (e) {
        Logger.log('⚠️ Auto-fill D/E/F error on row ' + lastRow + ': ' + e);
      }

      // Si réservation Airbnb: s'assurer que E = nombre de nuits, puis G = H / E
      if (r.type === 'airbnb') {
        try {
          // S'assurer que les formules (E notamment) ont calculé avant lecture
          SpreadsheetApp.flush();

          const eRange = sheet.getRange(lastRow, 5); // Colonne E
          let eVal = eRange.getValue();

          // Si E est vide/non numérique et que r.nights est fourni, on l'écrit
          const nightsNum = (r.nights != null && r.nights !== '') ? Number(r.nights) : null;
          const eNum = (eVal === '' || eVal === null) ? NaN : Number(eVal);
          if ((!isFinite(eNum) || eNum <= 0) && nightsNum != null && isFinite(nightsNum) && nightsNum > 0) {
            eRange.setValue(nightsNum);
            eVal = nightsNum;
          }

          // Calcul du tarif/nuit: G = H / E (sécurisé)
          const hValRaw = sheet.getRange(lastRow, 8).getValue(); // Colonne H
          const eValNum = Number(eVal);
          const hValNum = (hValRaw === '' || hValRaw === null) ? NaN : Number(hValRaw);

          if (isFinite(eValNum) && eValNum > 0 && isFinite(hValNum)) {
            const perNight = hValNum / eValNum;
            sheet.getRange(lastRow, 7).setValue(perNight); // Colonne G
          } else {
            // Évite des valeurs NULL/NaN dans G
            sheet.getRange(lastRow, 7).setValue('');
          }
        } catch (err) {
          Logger.log('⚠️ Airbnb post-fill error on row ' + lastRow + ': ' + err);
        }
      }

      // Fond jaune sur Début + Fin
      sheet.getRange(lastRow, iDebut+1, 1, 1).setBackground(YELLOW);
      sheet.getRange(lastRow, iFin+1,   1, 1).setBackground(YELLOW);

      bookingsExistantes.push({Debut: debutStr, Fin: finStr});
      totalAjoutes++;
    }

    // ----- Nettoyage anciens séparateurs (lignes totalement vides) -----
    removeEmptyRows(sheet, header.length);

    // ----- Tri par date Début -----
    if (sheet.getLastRow() > 1) {
      const range = sheet.getRange(2, 1, sheet.getLastRow()-1, header.length);
      range.sort({column: iDebut+1, ascending: true});
    }

    // ----- Insérer lignes vides entre changements de mois (vraiment vides) -----
    insertMonthSeparators(sheet, iDebut, header.length);

    Logger.log(`✅ ${totalAjoutes} nouvelles réservations insérées dans "${feuilleNom}"`);
  }

  Logger.log("=== FIN SYNCHRO JSON (HAR) ===");
}

// Copie pour la ligne cible les formules de colonnes données (ex: D,E,F)
// en cherchant vers le haut la première ligne qui contient une formule dans chaque colonne.
// Utilise R1C1 pour adapter correctement les références relatives à la nouvelle ligne.
function autoFillFormulasForRow(sheet, targetRow, columns) {
  if (!sheet || !targetRow || !Array.isArray(columns) || columns.length === 0) return;
  const firstDataRow = 2;
  const searchStart = targetRow - 1;
  if (searchStart < firstDataRow) return;

  columns.forEach(function(col) {
    let srcRow = null;
    for (let r = searchStart; r >= firstDataRow; r--) {
      const f = sheet.getRange(r, col).getFormula();
      if (f) { srcRow = r; break; }
    }
    if (srcRow) {
      const fR1C1 = sheet.getRange(srcRow, col).getFormulaR1C1();
      if (fR1C1) {
        sheet.getRange(targetRow, col).setFormulaR1C1(fR1C1);
      }
    }
  });
}

// Supprime toutes les lignes totalement vides (pour éviter d'accumuler des séparateurs)
function removeEmptyRows(sheet, colCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  for (let r = lastRow; r >= 2; r--) {
    const rowVals = sheet.getRange(r, 1, 1, colCount).getValues()[0];
    const allEmpty = rowVals.every(v => v === "" || v === null);
    if (allEmpty) {
      sheet.deleteRow(r);
    }
  }
}

// Insère une ligne vide avant chaque changement de mois (colonne Début)
// Et vide explicitement tout le contenu/format de cette ligne pour éviter 0€ / "Mois" / héritages.
function insertMonthSeparators(sheet, iDebut, colCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  const dateRange = sheet.getRange(2, iDebut+1, lastRow-1, 1);
  const values = dateRange.getValues().map(r => r[0]);

  let previousYM = null;
  let offset = 0;

  for (let i = 0; i < values.length; i++) {
    const cellVal = values[i];
    const d = toDateFromCell(cellVal);
    if (!d) continue;

    const currentYM = ymKey(d);
    if (previousYM && currentYM !== previousYM) {
      const rowToInsert = 2 + i + offset;
      sheet.insertRowBefore(rowToInsert);

      // S'assurer que la ligne insérée est VRAIMENT vide
      const sepRange = sheet.getRange(rowToInsert, 1, 1, colCount);
      sepRange.clear({ contentsOnly: true });  // enlève contenus (valeurs/formules)
      sepRange.clearFormat();                  // enlève les formats (ex: format monétaire)
      // Optionnel: empêcher une éventuelle auto-remplissage "intelligent" → réécrire des vides
      sepRange.setValues([Array(colCount).fill("")]);

      offset++;
    }
    previousYM = currentYM;
  }
}

// ================== Menu personnalisé ==================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Réservations Gîtes')
    .addItem('Actualiser depuis JSON (HAR)', 'majReservationsJSON')
    .addToUi();
}
