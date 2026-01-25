import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  CircularProgress,
  Divider,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { previewHar, previewIcal, importHarReservations, fetchImportLog } from '../services/api';
import { useThemeColors } from '../theme.jsx';

function formatDisplayDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortDisplayDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function formatLogDateTime(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatSourceLabel(source) {
  return source === 'ical' ? 'ICAL' : 'HAR';
}

function getReservationSourceMeta(reservation) {
  const rawSource = typeof reservation?.source === 'string' ? reservation.source.trim() : '';
  const typeValue = typeof reservation?.type === 'string' ? reservation.type.toLowerCase() : '';
  const label = rawSource || (typeValue === 'airbnb' ? 'Airbnb' : 'Perso');
  const normalized = (rawSource || typeValue).toLowerCase();
  let color = 'default';
  if (normalized.includes('airbnb')) {
    color = 'primary';
  } else if (normalized.includes('abritel')) {
    color = 'warning';
  } else if (normalized.includes('gites') || normalized.includes('gîtes')) {
    color = 'success';
  } else if (normalized.includes('direct') || normalized.includes('perso') || normalized.includes('personal')) {
    color = 'default';
  } else if (normalized) {
    color = 'info';
  }
  return { label, color };
}

function parseIsoDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function formatMonthLabel(date) {
  return date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}

function statusMetaList(status) {
  switch (status) {
    case 'new':
      return [{ label: 'Nouvelle', color: 'success', icon: <CheckCircleIcon /> }];
    case 'existing':
      return [{ label: 'Déjà présente', color: 'warning', icon: <InfoOutlinedIcon /> }];
    case 'price_missing':
      return [{ label: 'Prix manquant', color: 'warning', icon: <InfoOutlinedIcon /> }];
    case 'comment_missing':
      return [{ label: 'Commentaire manquant', color: 'warning', icon: <InfoOutlinedIcon /> }];
    case 'price_comment_missing':
      return [
        { label: 'Prix manquant', color: 'warning', icon: <InfoOutlinedIcon /> },
        { label: 'Commentaire manquant', color: 'warning', icon: <InfoOutlinedIcon /> }
      ];
    case 'outside_year':
      return [{ label: 'Hors année', color: 'info', icon: <InfoOutlinedIcon /> }];
    case 'invalid':
      return [{ label: 'Dates invalides', color: 'error', icon: <ErrorOutlineIcon /> }];
    case 'unknown':
      return [{ label: 'Gîte inconnu', color: 'error', icon: <ErrorOutlineIcon /> }];
    default:
      return [{ label: 'Statut inconnu', color: 'default', icon: <InfoOutlinedIcon /> }];
  }
}

function isSelectableStatus(status) {
  return status === 'new'
    || status === 'price_missing'
    || status === 'comment_missing'
    || status === 'price_comment_missing';
}

function isMissingStatus(status) {
  return status === 'price_missing'
    || status === 'comment_missing'
    || status === 'price_comment_missing';
}

function isCompactViewStatus(status) {
  return status === 'new' || isMissingStatus(status);
}

function matchesStatusGroup(status, group) {
  if (group === 'price_missing') {
    return status === 'price_missing' || status === 'price_comment_missing';
  }
  if (group === 'comment_missing') {
    return status === 'comment_missing' || status === 'price_comment_missing';
  }
  return status === group;
}

function isCompactViewGroup(group) {
  return group === 'new' || group === 'price_missing' || group === 'comment_missing';
}

export default function HarImportPanel({ panelBg }) {
  const theme = useTheme();
  const { theme: colorTheme } = useThemeColors();
  const headerColor = theme.palette.getContrastText(panelBg || '#ffffff');
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [previewSource, setPreviewSource] = useState('har');
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewStage, setPreviewStage] = useState('idle');
  const [importStage, setImportStage] = useState('idle');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importLog, setImportLog] = useState(null);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [logError, setLogError] = useState('');
  const [pendingScrollStatus, setPendingScrollStatus] = useState(null);

  const isIcalPreview = previewSource === 'ical';
  const previewSteps = isIcalPreview
    ? [
        'Chargement des ICAL',
        'Analyse et extraction',
        'Comparaison avec la feuille'
      ]
    : [
        'Lecture du fichier HAR',
        'Analyse et extraction',
        'Comparaison avec la feuille'
      ];

  const importSteps = [
    'Préparation de la sélection',
    'Insertion dans Google Sheets',
    'Finalisation (tri, séparateurs, surlignage)'
  ];

  const previewStageMessage = {
    reading: isIcalPreview
      ? 'Chargement des ICAL en cours...'
      : 'Lecture du fichier HAR en cours...',
    parsing: isIcalPreview
      ? 'Analyse et extraction des réservations ICAL...'
      : 'Analyse et extraction des réservations...',
    comparing: 'Comparaison avec la feuille Google Sheets...',
    error: isIcalPreview
      ? 'Une erreur est survenue pendant le traitement des ICAL.'
      : 'Une erreur est survenue pendant le traitement du HAR.'
  }[previewStage];

  const importStageMessage = {
    preparing: 'Préparation de l\'import...',
    inserting: 'Insertion des lignes dans Google Sheets...',
    error: 'Une erreur est survenue pendant l\'import.'
  }[importStage];

  const previewActiveStep = (() => {
    switch (previewStage) {
      case 'reading':
        return 0;
      case 'parsing':
        return 1;
      case 'comparing':
        return 2;
      case 'done':
        return previewSteps.length;
      default:
        return 0;
    }
  })();

  const importActiveStep = (() => {
    switch (importStage) {
      case 'preparing':
        return 0;
      case 'inserting':
        return 1;
      case 'done':
        return importSteps.length;
      default:
        return 0;
    }
  })();

  const showPreviewProgress = isParsing || previewStage === 'error';
  const showImportProgress = isImporting || importStage === 'error';

  const selectableCount = useMemo(() => {
    if (!preview?.reservations) return 0;
    return preview.reservations.filter(r => isSelectableStatus(r.status)).length;
  }, [preview]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedIds).filter(Boolean).length;
  }, [selectedIds]);

  const displayedReservations = useMemo(() => {
    if (!preview?.reservations) return [];
    return preview.reservations.filter(r => (showAll ? true : isCompactViewStatus(r.status)));
  }, [preview, showAll]);

  const groupedReservations = useMemo(() => {
    if (displayedReservations.length === 0) return [];
    const monthMap = new Map();
    displayedReservations.forEach(reservation => {
      const checkInDate = parseIsoDate(reservation.checkIn);
      const monthKey = checkInDate ? getMonthKey(checkInDate) : 'unknown';
      const monthLabel = checkInDate ? formatMonthLabel(checkInDate) : 'Date inconnue';
      const monthStart = checkInDate
        ? new Date(checkInDate.getFullYear(), checkInDate.getMonth(), 1)
        : null;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          key: monthKey,
          label: monthLabel,
          monthStart,
          gites: new Map()
        });
      }
      const monthGroup = monthMap.get(monthKey);
      const giteName = reservation.giteName || 'Gîte inconnu';
      if (!monthGroup.gites.has(giteName)) {
        monthGroup.gites.set(giteName, { name: giteName, reservations: [] });
      }
      monthGroup.gites.get(giteName).reservations.push(reservation);
    });

    return Array.from(monthMap.values())
      .sort((a, b) => {
        if (a.monthStart && b.monthStart) return a.monthStart - b.monthStart;
        if (a.monthStart) return -1;
        if (b.monthStart) return 1;
        return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
      })
      .map(monthGroup => ({
        key: monthGroup.key,
        label: monthGroup.label,
        gites: Array.from(monthGroup.gites.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
        )
      }));
  }, [displayedReservations]);

  const orderedReservations = useMemo(() => {
    if (groupedReservations.length === 0) return [];
    return groupedReservations.flatMap(monthGroup =>
      monthGroup.gites.flatMap(giteGroup => giteGroup.reservations)
    );
  }, [groupedReservations]);

  const priceMissingCount = (preview?.counts?.priceMissing || 0)
    + (preview?.counts?.priceCommentMissing || 0);
  const commentMissingCount = (preview?.counts?.commentMissing || 0)
    + (preview?.counts?.priceCommentMissing || 0);
  const totalCount = preview?.counts?.total || 0;
  const newCount = preview?.counts?.new || 0;
  const existingCount = preview?.counts?.existing || 0;
  const outsideYearCount = preview?.counts?.outsideYear || 0;
  const invalidCount = preview?.counts?.invalid || 0;

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewSource('har');
    setError('');
    setImportResult(null);
    setIsParsing(true);
    setPreviewStage('reading');
    setImportStage('idle');
    try {
      const text = await file.text();
      setPreviewStage('parsing');
      const json = JSON.parse(text);
      setPreviewStage('comparing');
      const result = await previewHar(json);
      if (!result?.success) {
        throw new Error('Réponse invalide du serveur.');
      }
      setPreview(result);
      const nextSelected = {};
      (result.reservations || []).forEach(r => {
        if (isSelectableStatus(r.status)) nextSelected[r.id] = true;
      });
      setSelectedIds(nextSelected);
      setPreviewStage('done');
    } catch (err) {
      setPreview(null);
      setSelectedIds({});
      setError('Impossible de lire le fichier HAR.');
      setPreviewStage('error');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleIcalPreview = async () => {
    setFileName('');
    setPreviewSource('ical');
    setError('');
    setImportResult(null);
    setIsParsing(true);
    setPreviewStage('reading');
    setImportStage('idle');
    try {
      const result = await previewIcal();
      if (!result?.success) {
        throw new Error('Réponse invalide du serveur.');
      }
      setPreview(result);
      const nextSelected = {};
      (result.reservations || []).forEach(r => {
        if (isSelectableStatus(r.status)) nextSelected[r.id] = true;
      });
      setSelectedIds(nextSelected);
      setPreviewStage('done');
    } catch (err) {
      setPreview(null);
      setSelectedIds({});
      setError('Impossible de comparer les ICAL chargés.');
      setPreviewStage('error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleToggleAll = () => {
    if (!preview?.reservations) return;
    const nextSelected = {};
    preview.reservations.forEach(r => {
      if (isSelectableStatus(r.status)) nextSelected[r.id] = true;
    });
    setSelectedIds(nextSelected);
  };

  const handleClearSelection = () => {
    setSelectedIds({});
  };

  const handleToggleReservation = id => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleImport = async () => {
    if (!preview?.reservations || selectedCount === 0) return;
    setIsImporting(true);
    setImportResult(null);
    setError('');
    setImportStage('preparing');
    try {
      const selection = preview.reservations.filter(r => selectedIds[r.id]);
      setImportStage('inserting');
      const result = await importHarReservations(selection);
      if (!result?.success) throw new Error('Import échoué.');
      setImportResult(result);
      setImportStage('done');
    } catch (err) {
      setError('Impossible d\'importer les réservations.');
      setImportStage('error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFetchImportLog = async () => {
    setIsFetchingLog(true);
    setLogError('');
    try {
      const result = await fetchImportLog(5);
      setImportLog(Array.isArray(result?.entries) ? result.entries : []);
    } catch (err) {
      setLogError('Impossible de charger le résumé des imports.');
    } finally {
      setIsFetchingLog(false);
    }
  };

  const handleScrollToStatus = status => {
    if (!preview?.reservations) return;
    if (!showAll && !isCompactViewGroup(status)) {
      setShowAll(true);
    }
    setPendingScrollStatus(status);
  };

  useEffect(() => {
    if (!pendingScrollStatus) return;
    const match = orderedReservations.find(r => matchesStatusGroup(r.status, pendingScrollStatus));
    if (!match) {
      setPendingScrollStatus(null);
      return;
    }
    const element = document.getElementById(`reservation-${match.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setPendingScrollStatus(null);
  }, [pendingScrollStatus, orderedReservations]);

  return (
    <Box sx={{ p: 2, pl: { xs: 1, sm: 2 } }}>
      <Typography variant="h6" sx={{ color: headerColor, mb: 2 }}>
        Import HAR / ICAL
      </Typography>

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Charger un fichier HAR ou utiliser les ICAL chargés pour comparer les réservations, puis valider l\'import.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={handlePickFile}
              startIcon={<UploadFileIcon />}
              disabled={isParsing}
            >
              Choisir un fichier HAR
            </Button>
            <Button variant="outlined" onClick={handleIcalPreview} disabled={isParsing}>
              Comparer les ICAL chargés
            </Button>
            {fileName && (
              <Chip label={fileName} variant="outlined" />
            )}
            {isParsing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption">Analyse en cours…</Typography>
              </Box>
            )}
          </Box>
          {error && (
            <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
              {error}
            </Typography>
          )}
          <input
            type="file"
            accept=".har,application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {showPreviewProgress && (
        <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {isIcalPreview ? 'Traitement des ICAL' : 'Traitement du HAR'}
            </Typography>
            {previewStageMessage && (
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                {previewStageMessage}
              </Typography>
            )}
            <Stepper activeStep={previewActiveStep} orientation="vertical">
              {previewSteps.map(label => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Résumé de la comparaison
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Chip variant="outlined" label={`Source: ${isIcalPreview ? 'ICAL' : 'HAR'}`} />
              <Chip label={`Total: ${totalCount}`} />
              <Chip
                color="success"
                label={`Nouvelles: ${newCount}`}
                clickable={newCount > 0}
                onClick={newCount > 0 ? () => handleScrollToStatus('new') : undefined}
              />
              <Chip
                color="warning"
                label={`Déjà présentes: ${existingCount}`}
                clickable={existingCount > 0}
                onClick={existingCount > 0 ? () => handleScrollToStatus('existing') : undefined}
              />
              <Chip
                color="warning"
                label={`Prix manquant: ${priceMissingCount}`}
                clickable={priceMissingCount > 0}
                onClick={priceMissingCount > 0 ? () => handleScrollToStatus('price_missing') : undefined}
              />
              <Chip
                color="warning"
                label={`Commentaire manquant: ${commentMissingCount}`}
                clickable={commentMissingCount > 0}
                onClick={commentMissingCount > 0 ? () => handleScrollToStatus('comment_missing') : undefined}
              />
              <Chip
                color="info"
                label={`Hors année: ${outsideYearCount}`}
                clickable={outsideYearCount > 0}
                onClick={outsideYearCount > 0 ? () => handleScrollToStatus('outside_year') : undefined}
              />
              <Chip
                color="error"
                label={`Invalides: ${invalidCount}`}
                clickable={invalidCount > 0}
                onClick={invalidCount > 0 ? () => handleScrollToStatus('invalid') : undefined}
              />
            </Box>
            {preview.byGite && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {Object.entries(preview.byGite).map(([giteName, stats]) => (
                  <Chip
                    key={giteName}
                    variant="outlined"
                    label={`${giteName}: +${stats.new || 0} / ${stats.existing || 0}`}
                  />
                ))}
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button variant="outlined" onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Afficher nouvelles / infos manquantes' : 'Afficher toutes les réservations'}
              </Button>
              <Button variant="text" onClick={handleToggleAll} disabled={selectableCount === 0}>
                Tout sélectionner
              </Button>
              <Button variant="text" onClick={handleClearSelection} disabled={selectedCount === 0}>
                Tout désélectionner
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Réservations détectées ({displayedReservations.length})
          </Typography>
          {groupedReservations.map(monthGroup => (
            <Box key={monthGroup.key} sx={{ mb: 2 }}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="subtitle2" sx={{ opacity: 0.7, textTransform: 'capitalize' }}>
                  {monthGroup.label}
                </Typography>
              </Divider>
              {monthGroup.gites.map(giteGroup => (
                <Box key={`${monthGroup.key}-${giteGroup.name}`} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    {giteGroup.name}
                  </Typography>
                  {giteGroup.reservations.map(r => {
                    const metaList = statusMetaList(r.status);
                    const isSelectable = isSelectableStatus(r.status);
                    const isChecked = !!selectedIds[r.id];
                    const sourceMeta = getReservationSourceMeta(r);
                    const checkInLabel = formatShortDisplayDate(r.checkIn);
                    const checkOutLabel = formatShortDisplayDate(r.checkOut);
                    const dateContent = checkInLabel && checkOutLabel ? (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{checkInLabel}</span>
                        <ArrowRightAltIcon fontSize="inherit" sx={{ opacity: 0.7 }} />
                        <span>{checkOutLabel}</span>
                      </Box>
                    ) : (checkInLabel || checkOutLabel || 'dates inconnues');
                    const showReason = r.reason && (!isSelectable || isMissingStatus(r.status));
                    return (
                      <Card
                        key={r.id}
                        id={`reservation-${r.id}`}
                        sx={{ mb: 1, boxShadow: 'none', bgcolor: colorTheme.cardBg }}
                      >
                        <CardContent sx={{ display: 'flex', gap: 2 }}>
                          <Checkbox
                            checked={isChecked}
                            onChange={() => handleToggleReservation(r.id)}
                            disabled={!isSelectable}
                            sx={{ mt: -0.5 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 1,
                                alignItems: 'center'
                              }}
                            >
                              <Typography variant="subtitle1">
                                {r.giteName || 'Gîte inconnu'} · {dateContent}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
                                {metaList.map((meta, index) => (
                                  <Chip
                                    key={`${r.id}-${meta.label}-${index}`}
                                    icon={meta.icon}
                                    label={meta.label}
                                    color={meta.color}
                                    variant="outlined"
                                    size="small"
                                  />
                                ))}
                              </Box>
                            </Box>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {r.name ? `Nom: ${r.name}` : 'Nom non renseigné'}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 0.5 }}>
                              <Chip
                                label={sourceMeta.label}
                                color={sourceMeta.color}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                              />
                              <Typography variant="body2">
                                {r.payout != null ? `Payout: ${r.payout}€` : 'Payout: n/a'}
                              </Typography>
                            </Box>
                            {r.comment && (
                              <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8 }}>
                                Commentaire: {r.comment}
                              </Typography>
                            )}
                            {showReason && (
                              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', opacity: 0.7 }}>
                                {r.reason}
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {preview && (
        <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={handleImport}
                disabled={selectedCount === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                    Import en cours…
                  </>
                ) : (
                  `Importer la sélection (${selectedCount})`
                )}
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {selectableCount} réservations sélectionnables (nouvelles ou infos manquantes).
              </Typography>
            </Box>
            {showImportProgress && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Insertion dans la feuille
                </Typography>
                {importStageMessage && (
                  <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                    {importStageMessage}
                  </Typography>
                )}
                <Stepper activeStep={importActiveStep} orientation="vertical">
                  {importSteps.map(label => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            )}
            {importResult && (
              <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
                Import terminé: {importResult.inserted} ajout(s), {importResult.updated || 0} mise(s) à jour de prix/commentaires, {importResult.skipped?.duplicate || 0} doublon(s) ignoré(s).
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1">
              Résumé des imports
            </Typography>
            <Button variant="outlined" onClick={handleFetchImportLog} disabled={isFetchingLog}>
              {isFetchingLog ? 'Chargement...' : 'Afficher le dernier import'}
            </Button>
          </Box>
          {logError && (
            <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
              {logError}
            </Typography>
          )}
          {Array.isArray(importLog) && importLog.length === 0 && (
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
              Aucun import enregistré.
            </Typography>
          )}
          {Array.isArray(importLog) && importLog.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {importLog.map((entry, index) => {
                const selectionCount = Number.isFinite(entry?.selectionCount) ? entry.selectionCount : 0;
                const inserted = Number.isFinite(entry?.inserted) ? entry.inserted : 0;
                const updated = Number.isFinite(entry?.updated) ? entry.updated : 0;
                const insertedItems = Array.isArray(entry?.insertedItems) ? entry.insertedItems : [];
                const hasInsertedItems = insertedItems.length > 0;
                const entryKey = entry?.id || entry?.at || `${entry?.source || 'import'}-${index}`;
                return (
                  <Box
                    key={entryKey}
                    sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                      <Chip label={formatSourceLabel(entry?.source)} size="small" variant="outlined" />
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {formatLogDateTime(entry?.at)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectionCount} sélectionnée(s) · {inserted} ajoutée(s) · {updated} mise(s) à jour
                    </Typography>
                    {hasInsertedItems ? (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', fontWeight: 600, opacity: 0.7 }}
                        >
                          Ajouts
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
                          {insertedItems.map((item, itemIndex) => {
                            const giteLabel = item?.giteName || item?.giteId || 'Gîte inconnu';
                            const checkInLabel = formatShortDisplayDate(item?.checkIn);
                            const checkOutLabel = formatShortDisplayDate(item?.checkOut);
                            const dateContent = checkInLabel && checkOutLabel ? (
                              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <span>{checkInLabel}</span>
                                <ArrowRightAltIcon fontSize="inherit" sx={{ opacity: 0.7 }} />
                                <span>{checkOutLabel}</span>
                              </Box>
                            ) : (checkInLabel || checkOutLabel || 'dates inconnues');
                            return (
                              <Typography
                                key={`${entryKey}-inserted-${itemIndex}`}
                                variant="caption"
                                sx={{ opacity: 0.7 }}
                              >
                                {giteLabel} · {dateContent}
                              </Typography>
                            );
                          })}
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', opacity: 0.7 }}>
                        Aucun ajout.
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
