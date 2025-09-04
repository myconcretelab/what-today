// ================== Source JSON ==================
// Remplacement des flux iCal: on charge désormais un JSON consolidé.
const HAR_JSON_URL = 'https://today.gites-broceliande.com/api/har-calendar';

const YELLOW = '#fff9c4'; // jaune très léger (MD Yellow 100)
const RUN_COL_INDEX = 15; // Colonne O pour marquer les lignes insérées

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
  const props = PropertiesService.getDocumentProperties();
  const runId = new Date().toISOString();
  props.setProperty('lastRunId', runId);
  ss.toast('Mise à jour des réservations…', 'Synchronisation', 5);

  // Récupération du JSON consolidé (par gîte)
  let all;
  try {
    const resp = UrlFetchApp.fetch(HAR_JSON_URL, { muteHttpExceptions: true, followRedirects: true });
    const status = resp.getResponseCode();
    const text = resp.getContentText();
    Logger.log('Fetch JSON: status=' + status + ', taille=' + (text ? text.length : 0));
    all = JSON.parse(text);
    Logger.log('JSON parsé: ' + Object.keys(all || {}).length + ' feuille(s) détectée(s)');
  } catch (e) {
    Logger.log('❌ Erreur de chargement JSON: ' + e);
    return;
  }

  // Pour chaque feuille (gîte) existante, injecter les réservations correspondantes
  const sheetNames = Object.keys(all);
  Logger.log('Feuilles à traiter: ' + sheetNames.length);
  const perSheetCounts = {};
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
    Logger.log('Index colonnes -> Nom: ' + iNom + ', Debut: ' + iDebut + ', Fin: ' + iFin + ', Paiement: ' + iPaiement);
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
    Logger.log('Réservations à examiner (' + feuilleNom + '): ' + reservations.length);
    for (let i = 0; i < reservations.length; i++) {
      const r = reservations[i];
      // r: { type, checkIn: 'YYYY-MM-DD', checkOut: 'YYYY-MM-DD', nights, name, payout, comment }
      const dStart = toDateFromCell(r.checkIn);
      const dEnd   = toDateFromCell(r.checkOut);
      if (!dStart || !dEnd) {
        Logger.log('⏭️ Réservation ignorée (dates invalides) ' + JSON.stringify({ checkIn: r.checkIn, checkOut: r.checkOut, name: r.name }));
        continue;
      }
      if (!overlapsCurrentYear(dStart, dEnd)) {
        Logger.log('⏭️ Hors année courante: ' + r.checkIn + ' → ' + r.checkOut + ' (' + (r.name || '') + ')');
        continue; // filtre année courante (même logique qu'avant)
      }

      const debutStr = formatDateFR(dStart);
      const finStr   = formatDateFR(dEnd);

      // Doublon simple Début + Fin (au format affiché)
      const doublon = bookingsExistantes.some(b => b.Debut === debutStr && b.Fin === finStr);
      if (doublon) {
        Logger.log('↪️ Doublon ignoré: ' + debutStr + ' → ' + finStr + ' (' + (r.name || '') + ')');
        continue;
      }

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
      //                        colonne H (8) = payout (Total) ou formule pour "personal"
      //                        colonne J (10) = comment
      const paiementText = (r.type === 'airbnb') ? 'Airbnb' : 'A définir';
      sheet.getRange(lastRow, 9).setValue(paiementText); // Colonne I
      if (r.payout != null) sheet.getRange(lastRow, 8).setValue(r.payout); // Colonne H
      if (r.comment) sheet.getRange(lastRow, 10).setValue(r.comment); // Colonne J
      if (iNom === -1 && r.name) sheet.getRange(lastRow, 1).setValue(r.name); // Sécurité si pas d'entête "Nom"

      // Fond jaune sur toute la ligne colonnes A→J (1 à 10)
      sheet.getRange(lastRow, 1, 1, 10).setBackground(YELLOW);

      // Marquer la ligne avec l'ID de run en colonne O (seul marqueur)
      try {
        sheet.getRange(lastRow, RUN_COL_INDEX).setValue(runId);
      } catch (err) {
        Logger.log('⚠️ Impossible d\'écrire le marqueur de run en colonne O (ligne ' + lastRow + ') : ' + err);
      }

      // D/E/F: appliquer les formules et valeurs demandées pour la nouvelle ligne
      // D (4): =B{row} puis appliquer le format "mm (mmmm)" → mois du début
      // E (5): =C{row}-B{row}               → nombre de nuits
      // F (6): valeur fixe selon le gîte    → Gree/Phonsine/Edmond: 2, Liberté: 10
      try {
        // Formules en A1
        // D: simple référence à B pour éviter TEXT() qui pose problème selon la locale
        sheet.getRange(lastRow, 4).setFormula('=B' + lastRow);
        sheet.getRange(lastRow, 5).setFormula('=C' + lastRow + '-B' + lastRow);

        // Valeur fixe en F selon le nom de la feuille
        var fVal = '';
        switch ((feuilleNom || '').toLowerCase()) {
          case 'gree':
          case 'phonsine':
          case 'edmond':
            fVal = 2; break;
          case 'liberté':
          case 'liberte':
            fVal = 10; break;
          default:
            fVal = '';
        }
        if (fVal !== '') sheet.getRange(lastRow, 6).setValue(fVal);

        // S'assurer que D/E/F ont le bon format d'affichage.
        // D doit afficher le mois du début → format personnalisé "mm (mmmm)".
        // La mise en forme peut échouer si la colonne est une "colonne saisie" (data source, etc.).
        // On isole chaque opération pour éviter d'interrompre l'exécution complète.
        try {
          sheet.getRange(lastRow, 4).setNumberFormat('mm (mmmm)');
        } catch (fmtErr) {
          Logger.log('ℹ️ Format nombre D ignoré (ligne ' + lastRow + ') : ' + fmtErr);
        }
        try {
          var eFmt = sheet.getRange(2, 5).getNumberFormat();
          if (eFmt) sheet.getRange(lastRow, 5).setNumberFormat(eFmt);
        } catch (fmtErr) {
          Logger.log('ℹ️ Format nombre E ignoré (ligne ' + lastRow + ') : ' + fmtErr);
        }
        try {
          var fFmt = sheet.getRange(2, 6).getNumberFormat();
          if (fFmt) sheet.getRange(lastRow, 6).setNumberFormat(fFmt);
        } catch (fmtErr) {
          Logger.log('ℹ️ Format nombre F ignoré (ligne ' + lastRow + ') : ' + fmtErr);
        }
      } catch (err) {
        Logger.log('⚠️ Application formules/format D/E/F échouée (ligne ' + lastRow + '): ' + err);
      }

      // --- Post auto-fill: règles spécifiques Airbnb / Personal ---
      // Objectif:
      // - Vérifier que la colonne E (5) contient bien le nombre de nuits
      // - Pour Airbnb: G (7) = H (8) / E (5)
      // - Pour Personal: H (8) = G (7) * E (5)
      // - Sécuriser: éviter division par 0 / NULL
      if (r.type === 'airbnb') {
        try {
          // Calcul du nombre de nuits attendu à partir des dates de la réservation
          var nightsExpected = 0;
          if (dStart && dEnd) {
            nightsExpected = Math.max(0, Math.round((dEnd.getTime() - dStart.getTime()) / (24 * 60 * 60 * 1000)));
          }

          // Lecture des valeurs actuelles en E et H
          var eRange = sheet.getRange(lastRow, 5); // E = Nuits (souvent une formule)
          var hRange = sheet.getRange(lastRow, 8); // H = Total (payout)
          var gRange = sheet.getRange(lastRow, 7); // G = Résultat (H/E)

          var eVal = eRange.getValue();
          var hVal = hRange.getValue();
          var hasEFormula = !!eRange.getFormula();

          // Normalisation numérique
          var eNum = (typeof eVal === 'number') ? eVal : parseFloat(String(eVal).replace(',', '.'));
          var hNum = (typeof hVal === 'number') ? hVal : parseFloat(String(hVal).replace(',', '.'));

          // Si E n'a pas de formule et est invalide, on le remplit avec la valeur attendue.
          if (!hasEFormula && (!isFinite(eNum) || eNum <= 0 || (nightsExpected && eNum !== nightsExpected))) {
            eNum = nightsExpected;
            if (isFinite(eNum) && eNum > 0) eRange.setValue(eNum);
          }
          // Si E a une formule, préférer nightsExpected si E n'est pas encore calculé
          if (hasEFormula && (!isFinite(eNum) || eNum <= 0)) {
            eNum = nightsExpected;
          }

          // Calcul et écriture en G uniquement si H et E sont valides
          var perNight = null;
          if (isFinite(hNum) && isFinite(eNum) && eNum > 0) {
            perNight = hNum / eNum;
            gRange.setValue(perNight);
          } else {
            // Si non calculable, on laisse G vide pour éviter NULL/NaN
            gRange.setValue('');
          }
          Logger.log('Airbnb post-traitement (ligne ' + lastRow + '): nightsExpected=' + nightsExpected + ', E=' + eNum + ' (formule=' + hasEFormula + '), H=' + hNum + ', G(H/E)=' + (perNight !== null ? perNight : ''));
        } catch (err) {
          Logger.log('⚠️ Erreur post-traitement Airbnb (ligne ' + lastRow + '): ' + err);
        }
      }

      // Personal: calculer automatiquement le total en H = G * E
      if (r.type === 'personal') {
        try {
          var hCell = sheet.getRange(lastRow, 8); // H
          hCell.setFormula('=G' + lastRow + '*E' + lastRow);
          try {
            var hFmt = sheet.getRange(2, 8).getNumberFormat();
            if (hFmt) hCell.setNumberFormat(hFmt);
          } catch (fmtErr) {
            Logger.log('ℹ️ Format nombre H ignoré (ligne ' + lastRow + ') : ' + fmtErr);
          }
        } catch (err) {
          Logger.log('⚠️ Erreur post-traitement Personal (ligne ' + lastRow + '): ' + err);
        }
      }

      Logger.log('➕ Ajout réservation: [' + (r.name || '') + '] ' + debutStr + ' → ' + finStr + ' | type=' + (r.type || '') + (r.payout != null ? (', payout=' + r.payout) : ''));
      bookingsExistantes.push({Debut: debutStr, Fin: finStr});
      totalAjoutes++;
    }

    // ----- Nettoyage anciens séparateurs (lignes totalement vides) -----
    const removed = removeEmptyRows(sheet, header.length);
    if (removed > 0) Logger.log('🧹 Lignes vides supprimées: ' + removed);

    // ----- Tri par date Début -----
    if (sheet.getLastRow() > 1) {
      const range = sheet.getRange(2, 1, sheet.getLastRow()-1, header.length);
      range.sort({column: iDebut+1, ascending: true});
      Logger.log('🔀 Tri appliqué sur ' + (sheet.getLastRow()-1) + ' ligne(s)');
    }

    // ----- Insérer lignes vides entre changements de mois (vraiment vides) -----
    const inserted = insertMonthSeparators(sheet, iDebut, header.length);
    if (inserted > 0) Logger.log('➖ Séparateurs de mois insérés: ' + inserted);

    Logger.log(`✅ ${totalAjoutes} nouvelles réservations insérées dans "${feuilleNom}"`);
    perSheetCounts[feuilleNom] = totalAjoutes;
    ss.toast('Fini ' + feuilleNom + ': ' + totalAjoutes + ' ajout(s)', 'Synchronisation', 3);
  }

  // Afficher un résumé en modal avec le nombre d'insertion par gîte
  try {
    const ui = SpreadsheetApp.getUi();
    const total = Object.values(perSheetCounts).reduce((a, b) => a + b, 0);
    const rows = Object.keys(perSheetCounts)
      .sort()
      .map(name => '<tr><td style="padding:4px 8px;">' + name + '</td><td style="padding:4px 8px;text-align:right;">' + perSheetCounts[name] + '</td></tr>')
      .join('');
    const html = HtmlService
      .createHtmlOutput(
        '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;">' +
          '<h3 style="margin:0 0 8px 0;">Synchronisation terminée</h3>' +
          '<p style="margin:0 0 8px 0;">Nombre d\'insertions par gîte pour cette exécution:</p>' +
          '<table style="border-collapse:collapse;">' +
            '<tbody>' + (rows || '<tr><td>Aucun gîte</td><td style="text-align:right;">0</td></tr>') + '</tbody>' +
            '<tfoot>' +
              '<tr>' +
                '<td style="padding:6px 8px;border-top:1px solid #ddd;font-weight:bold;">Total</td>' +
                '<td style="padding:6px 8px;border-top:1px solid #ddd;text-align:right;font-weight:bold;">' + total + '</td>' +
              '</tr>' +
            '</tfoot>' +
          '</table>' +
        '</div>'
      )
      .setWidth(360)
      .setHeight(200);
    ui.showModalDialog(html, 'Résumé des insertions');
  } catch (e) {
    Logger.log('⚠️ Impossible d\'afficher le modal de résumé : ' + e);
  }

  Logger.log("=== FIN SYNCHRO JSON (HAR) ===");
  ss.toast('Synchronisation terminée', 'Synchronisation', 3);
}

// Supprime les lignes insérées lors de la toute dernière exécution
function supprimerDernieresInsertions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getDocumentProperties();
  let runId = props.getProperty('lastRunId');
  let totalDeleted = 0;

  // Si aucun runId en propriétés, essayer de déduire le plus récent en scannant la colonne O
  if (!runId) {
    let newest = null;
    ss.getSheets().forEach(sheet => {
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;
      const col = sheet.getRange(2, RUN_COL_INDEX, lastRow - 1, 1).getValues();
      for (let r = 0; r < col.length; r++) {
        const v = String(col[r][0] || '').trim();
        if (!v) continue;
        if (!newest || v > newest) newest = v; // ISO-compatible ordre lexicographique
      }
    });
    if (newest) {
      runId = newest;
    }
  }

  if (!runId) {
    SpreadsheetApp.getUi().alert('Aucun marqueur de dernière exécution trouvé (colonne O).');
    return;
  }

  ss.getSheets().forEach(sheet => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) return;

    const runMarks = sheet.getRange(2, RUN_COL_INDEX, lastRow - 1, 1).getValues();

    // Collecter les index de lignes à supprimer (relatifs à la feuille)
    const toDelete = [];
    for (let r = 0; r < runMarks.length; r++) {
      const mark = String((runMarks[r] && runMarks[r][0]) || '').trim();
      const colMatch = (mark === runId);
      if (colMatch) toDelete.push(r + 2); // Ligne réelle = r + 2
    }

    // Supprimer de bas en haut pour ne pas décaler les indices
    for (let i = toDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(toDelete[i]);
      totalDeleted++;
    }
  });

  // Option: on nettoie l'ID pour éviter une suppression répétée accidentelle
  props.deleteProperty('lastRunId');

  SpreadsheetApp.getUi().alert('Suppression terminée. Lignes supprimées: ' + totalDeleted);
}

// Supprime toutes les lignes totalement vides (pour éviter d'accumuler des séparateurs)
function removeEmptyRows(sheet, colCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  let removed = 0;
  for (let r = lastRow; r >= 2; r--) {
    const rowVals = sheet.getRange(r, 1, 1, colCount).getValues()[0];
    const allEmpty = rowVals.every(v => v === "" || v === null);
    if (allEmpty) {
      sheet.deleteRow(r);
      removed++;
    }
  }
  return removed;
}

// Insère une ligne vide avant chaque changement de mois (colonne Début)
// Et vide explicitement tout le contenu/format de cette ligne pour éviter 0€ / "Mois" / héritages.
function insertMonthSeparators(sheet, iDebut, colCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return 0;

  const dateRange = sheet.getRange(2, iDebut+1, lastRow-1, 1);
  const values = dateRange.getValues().map(r => r[0]);

  let previousYM = null;
  let offset = 0;
  let inserted = 0;

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
      inserted++;
    }
    previousYM = currentYM;
  }
  return inserted;
}

// Recopie, pour une nouvelle ligne, les formules des colonnes indiquées
// depuis la première ligne au-dessus qui contient une formule dans ces colonnes.
function autoFillFormulasFromAbove(sheet, targetRow, columns) {
  if (!Array.isArray(columns) || columns.length === 0) return;
  // Pour chaque colonne, remonter jusqu'à trouver une formule, puis copier en R1C1
  for (var i = 0; i < columns.length; i++) {
    var col = columns[i];
    var r = targetRow - 1;
    while (r >= 2) { // ignorer l'entête ligne 1
      var cell = sheet.getRange(r, col);
      var formula = cell.getFormula();
      if (formula) {
        var fR1C1 = cell.getFormulaR1C1();
        sheet.getRange(targetRow, col).setFormulaR1C1(fR1C1);
        break;
      }
      r--;
    }
  }
}

// ================== Menu personnalisé ==================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Réservations Gîtes')
    .addItem('Actualiser depuis JSON (HAR)', 'majReservationsJSON')
    .addItem('Supprimer dernières insertions', 'supprimerDernieresInsertions')
    .addToUi();
}
