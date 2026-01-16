// ================== Import HAR ==================
// Le parsing et l'insertion des réservations HAR sont désormais gérés par le serveur.
// Ce script conserve uniquement les actions manuelles sur la feuille.

const YELLOW = '#fff9c4'; // jaune très léger (MD Yellow 100)
const RUN_COL_INDEX = 15; // Colonne O pour marquer les lignes insérées
// Ordre attendu des colonnes (D supprimée)
const COL_NOM = 1;        // A
const COL_DEBUT = 2;      // B
const COL_FIN = 3;        // C
const COL_NUITS = 4;      // D
const COL_ADULTES = 5;    // E
const COL_PRIX_NUIT = 6;  // F
const COL_REVENUS = 7;    // G
const COL_PAIEMENT = 8;   // H
const COL_COMMENT = 9;    // I (optionnel)
// Certaines feuilles/colonnes sont des colonnes saisies (DataSource/Input) et
// n'autorisent pas setNumberFormat. Désactiver les formats au niveau cellule.
const APPLY_CELL_FORMATS = false;

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

// Détermine si une réservation chevauche un changement de mois
function chevaucheChangementDeMois(dDebut, dFin) {
  if (!dDebut || !dFin) return false;
  const endInclusive = new Date(dFin.getFullYear(), dFin.getMonth(), dFin.getDate() - 1);
  return ymKey(dDebut) !== ymKey(endInclusive);
}

function premierJourMoisSuivant(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

// Vérifie toutes les réservations et scinde celles qui chevauchent deux mois
function verifierEtScinderChevauchementsCore(showSummary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const perSheet = {};
  const props = PropertiesService.getDocumentProperties();
  const runId = props.getProperty('lastRunId');

  ss.toast('Vérification des chevauchements…', 'Scission réservations', 5);

  ss.getSheets().forEach(sheet => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) return;

    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const iDebut = getColumnIndex(header, 'Debut');
    const iFin = getColumnIndex(header, 'Fin');
    if (iDebut === -1 || iFin === -1) return;
    const iNuits = getColumnIndex(header, 'Nb Nuits');
    const iAdultes = getColumnIndex(header, 'Nb Adultes');
    let iPrixNuit = getColumnIndex(header, 'Prix/nuits');
    if (iPrixNuit === -1) iPrixNuit = getColumnIndex(header, 'Prix/nuit');
    const iRevenus = getColumnIndex(header, 'Revenus');
    const iPaiement = getColumnIndex(header, 'Paiement');
    let iComment = getColumnIndex(header, 'Comment');
    if (iComment === -1) iComment = getColumnIndex(header, 'Commentaire');

    const colNuits = (iNuits !== -1) ? iNuits + 1 : COL_NUITS;
    const colAdultes = (iAdultes !== -1) ? iAdultes + 1 : COL_ADULTES;
    const colPrixNuit = (iPrixNuit !== -1) ? iPrixNuit + 1 : COL_PRIX_NUIT;
    const colRevenus = (iRevenus !== -1) ? iRevenus + 1 : COL_REVENUS;
    const colPaiement = (iPaiement !== -1) ? iPaiement + 1 : COL_PAIEMENT;
    const colComment = (iComment !== -1) ? iComment + 1 : null;
    const highlightCols = Math.max(colPaiement, colRevenus, colPrixNuit, colAdultes, colNuits, colComment || 0);

    // Set de toutes les paires existantes "Debut|Fin" (formatées dd/MM/yyyy)
    const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const pairSet = new Set();
    for (let r = 0; r < allData.length; r++) {
      const d = toDateFromCell(allData[r][iDebut]);
      const f = toDateFromCell(allData[r][iFin]);
      const ds = formatDateFR(d);
      const fs = formatDateFR(f);
      if (ds && fs) pairSet.add(ds + '|' + fs);
    }

    // Collecter les lignes à traiter puis à supprimer
    const aScinder = [];
    for (let r = 0; r < allData.length; r++) {
      const d = toDateFromCell(allData[r][iDebut]);
      const f = toDateFromCell(allData[r][iFin]);
      if (!d || !f) continue;
      if (!chevaucheChangementDeMois(d, f)) continue;
      aScinder.push({
        rowIndex: r + 2, // index réel dans la feuille
        values: allData[r]
      });
    }

    let inserted = 0;
    const toDelete = [];

    // Pour chaque ligne à scinder
    aScinder.forEach(item => {
      const original = item.values.slice();
      const dStart = toDateFromCell(original[iDebut]);
      const dEnd = toDateFromCell(original[iFin]);
      if (!dStart || !dEnd) return;

      const boundary = premierJourMoisSuivant(dStart);

      const seg1Debut = formatDateFR(dStart);
      const seg1Fin = formatDateFR(boundary);
      const seg2Debut = formatDateFR(boundary);
      const seg2Fin = formatDateFR(dEnd);

      // Vérifications de non‑doublon
      const hasSeg1 = pairSet.has(seg1Debut + '|' + seg1Fin);
      const hasSeg2 = pairSet.has(seg2Debut + '|' + seg2Fin);

      // Déterminer type de réservation via colonne Paiement
      const typeCell = String((original[colPaiement - 1] || '')).toLowerCase();
      const type = (typeCell.indexOf('airbnb') !== -1) ? 'airbnb' : 'personal';

      // Helper d'ajout d'une nouvelle ligne à partir de la copie
      function appendSegment(debutStr, finStr) {
        const rowCopy = original.slice();
        rowCopy[iDebut] = debutStr;
        rowCopy[iFin] = finStr;
        // D/E recalculées après append → laisser vides pour l'instant
        if (rowCopy.length >= colNuits) rowCopy[colNuits - 1] = '';
        if (rowCopy.length >= colAdultes) rowCopy[colAdultes - 1] = '';
        sheet.appendRow(rowCopy);
        const newRow = sheet.getLastRow();
        // Marquage visuel + runId si dispo
        try { sheet.getRange(newRow, 1, 1, highlightCols).setBackground(YELLOW); } catch (e) {}
        try { if (runId) sheet.getRange(newRow, RUN_COL_INDEX).setValue(runId); } catch (e) {}

        // Formule D et valeur E comme lors de l'insertion JSON
        try {
          sheet.getRange(newRow, colNuits).setFormula('=C' + newRow + '-B' + newRow);

          // E selon le nom de la feuille
          let fVal = '';
          switch ((sheet.getName() || '').toLowerCase()) {
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
          if (fVal !== '') sheet.getRange(newRow, colAdultes).setValue(fVal);

          // Formats (meilleurs-efforts)
          if (APPLY_CELL_FORMATS) {
            try { const dFmt = sheet.getRange(2, colNuits).getNumberFormat(); if (dFmt) sheet.getRange(newRow, colNuits).setNumberFormat(dFmt); } catch (e) {}
            try { const eFmt = sheet.getRange(2, colAdultes).getNumberFormat(); if (eFmt) sheet.getRange(newRow, colAdultes).setNumberFormat(eFmt); } catch (e) {}
          }

          // Post-traitement F/G selon type
          if (type === 'airbnb') {
            try {
              const eRange = sheet.getRange(newRow, colNuits);
              const hRange = sheet.getRange(newRow, colRevenus);
              const gRange = sheet.getRange(newRow, colPrixNuit);
              const eVal = eRange.getValue();
              const hVal = hRange.getValue();
              const eNum = (typeof eVal === 'number') ? eVal : parseFloat(String(eVal).replace(',', '.'));
              const hNum = (typeof hVal === 'number') ? hVal : parseFloat(String(hVal).replace(',', '.'));
              if (isFinite(hNum) && isFinite(eNum) && eNum > 0) {
                gRange.setValue(hNum / eNum);
              } else {
                gRange.setValue('');
              }
            } catch (err) {}
          } else {
            try {
              const hCell = sheet.getRange(newRow, colRevenus);
              hCell.setFormula('=F' + newRow + '*D' + newRow);
              if (APPLY_CELL_FORMATS) {
                try { const hFmt = sheet.getRange(2, colRevenus).getNumberFormat(); if (hFmt) hCell.setNumberFormat(hFmt); } catch (e) {}
              }
            } catch (err) {}
          }
        } catch (e) {}

        inserted++;
        return newRow;
      }

      // Ajouter les segments manquants
      if (!hasSeg1) {
        appendSegment(seg1Debut, seg1Fin);
        pairSet.add(seg1Debut + '|' + seg1Fin);
      }
      if (!hasSeg2) {
        appendSegment(seg2Debut, seg2Fin);
        pairSet.add(seg2Debut + '|' + seg2Fin);
      }

      // Si les deux segments existent désormais, planifier la suppression de la ligne d'origine
      if (pairSet.has(seg1Debut + '|' + seg1Fin) && pairSet.has(seg2Debut + '|' + seg2Fin)) {
        toDelete.push(item.rowIndex);
      }
    });

    // Supprimer les lignes originales (du bas vers le haut)
    toDelete.sort((a, b) => b - a).forEach(r => {
      try { sheet.deleteRow(r); } catch (e) {}
    });

    // Option: retrier et réinsérer les séparateurs de mois
    if (sheet.getLastRow() > 1) {
      const iDebutNow = getColumnIndex(header, 'Debut');
      if (iDebutNow !== -1) {
        const range = sheet.getRange(2, 1, sheet.getLastRow()-1, header.length);
        range.sort({column: iDebutNow + 1, ascending: true});
        insertMonthSeparators(sheet, iDebutNow, header.length);
      }
    }

    if (aScinder.length > 0 || inserted > 0 || toDelete.length > 0) {
      perSheet[sheet.getName()] = { trouves: aScinder.length, inseres: inserted, supprimes: toDelete.length };
    }
  });

  // Résumé
  const names = Object.keys(perSheet);
  if (showSummary === undefined) showSummary = true;
  if (!showSummary) return; // pas d'UI si appelé en interne
  if (names.length === 0) {
    ui.alert('Vérification terminée', 'Aucun chevauchement détecté.', ui.ButtonSet.OK);
    return;
  }

  const rows = names
    .sort()
    .map(n => {
      const x = perSheet[n];
      return '<tr><td style="padding:4px 8px;">' + n + '</td>' +
             '<td style="padding:4px 8px;text-align:right;">' + x.trouves + '</td>' +
             '<td style="padding:4px 8px;text-align:right;">' + x.inseres + '</td>' +
             '<td style="padding:4px 8px;text-align:right;">' + x.supprimes + '</td></tr>';
    })
    .join('');

  try {
    const html = HtmlService
      .createHtmlOutput(
        '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;">' +
          '<h3 style="margin:0 0 8px 0;">Vérification des chevauchements</h3>' +
          '<p style="margin:0 0 8px 0;">Lignes trouvées, segments insérés et lignes supprimées:</p>' +
          '<table style="border-collapse:collapse;">' +
            '<thead><tr><th style="text-align:left;padding:4px 8px;">Feuille</th><th style="text-align:right;padding:4px 8px;">Chevauch.</th><th style="text-align:right;padding:4px 8px;">Insérés</th><th style="text-align:right;padding:4px 8px;">Supprimés</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="4">Aucun</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>'
      )
      .setWidth(520)
      .setHeight(220);
    ui.showModalDialog(html, 'Chevauchements – Résumé');
  } catch (e) {
    ui.alert('Vérification terminée', names.length + ' feuille(s) traitée(s).', ui.ButtonSet.OK);
  }
}

// Wrapper pour menu (affiche le résumé)
function verifierEtScinderChevauchements() {
  verifierEtScinderChevauchementsCore(true);
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
    .addItem('Supprimer dernières insertions', 'supprimerDernieresInsertions')
    .addItem('Vérifier chevauchements et scinder', 'verifierEtScinderChevauchements')
    .addToUi();
}
