import React, { useMemo, useRef, useState } from 'react';
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
import { previewHar, previewIcal, importHarReservations } from '../services/api';
import { useThemeColors } from '../theme.jsx';

function formatDisplayDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function statusMeta(status) {
  switch (status) {
    case 'new':
      return { label: 'Nouvelle', color: 'success', icon: <CheckCircleIcon /> };
    case 'existing':
      return { label: 'Déjà présente', color: 'warning', icon: <InfoOutlinedIcon /> };
    case 'price_missing':
      return { label: 'Prix manquant', color: 'warning', icon: <InfoOutlinedIcon /> };
    case 'comment_missing':
      return { label: 'Commentaire manquant', color: 'warning', icon: <InfoOutlinedIcon /> };
    case 'price_comment_missing':
      return { label: 'Prix et commentaire manquants', color: 'warning', icon: <InfoOutlinedIcon /> };
    case 'outside_year':
      return { label: 'Hors année', color: 'info', icon: <InfoOutlinedIcon /> };
    case 'invalid':
      return { label: 'Dates invalides', color: 'error', icon: <ErrorOutlineIcon /> };
    case 'unknown':
      return { label: 'Gîte inconnu', color: 'error', icon: <ErrorOutlineIcon /> };
    default:
      return { label: 'Statut inconnu', color: 'default', icon: <InfoOutlinedIcon /> };
  }
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
    return preview.reservations.filter(
      r => r.status === 'new'
        || r.status === 'price_missing'
        || r.status === 'comment_missing'
        || r.status === 'price_comment_missing'
    ).length;
  }, [preview]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedIds).filter(Boolean).length;
  }, [selectedIds]);

  const displayedReservations = useMemo(() => {
    if (!preview?.reservations) return [];
    return preview.reservations.filter(r => (
      showAll ? true : (r.status === 'new'
        || r.status === 'price_missing'
        || r.status === 'comment_missing'
        || r.status === 'price_comment_missing')
    ));
  }, [preview, showAll]);

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
        if (
          r.status === 'new'
          || r.status === 'price_missing'
          || r.status === 'comment_missing'
          || r.status === 'price_comment_missing'
        ) nextSelected[r.id] = true;
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
        if (
          r.status === 'new'
          || r.status === 'price_missing'
          || r.status === 'comment_missing'
          || r.status === 'price_comment_missing'
        ) nextSelected[r.id] = true;
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
      if (
        r.status === 'new'
        || r.status === 'price_missing'
        || r.status === 'comment_missing'
        || r.status === 'price_comment_missing'
      ) nextSelected[r.id] = true;
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
              <Chip label={`Total: ${preview.counts?.total || 0}`} />
              <Chip color="success" label={`Nouvelles: ${preview.counts?.new || 0}`} />
              <Chip color="warning" label={`Déjà présentes: ${preview.counts?.existing || 0}`} />
              <Chip color="warning" label={`Prix manquant: ${preview.counts?.priceMissing || 0}`} />
              <Chip color="warning" label={`Commentaire manquant: ${preview.counts?.commentMissing || 0}`} />
              <Chip color="warning" label={`Prix et commentaire manquants: ${preview.counts?.priceCommentMissing || 0}`} />
              <Chip color="info" label={`Hors année: ${preview.counts?.outsideYear || 0}`} />
              <Chip color="error" label={`Invalides: ${preview.counts?.invalid || 0}`} />
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
          {displayedReservations.map(r => {
            const meta = statusMeta(r.status);
            const isSelectable = r.status === 'new'
              || r.status === 'price_missing'
              || r.status === 'comment_missing'
              || r.status === 'price_comment_missing';
            const isChecked = !!selectedIds[r.id];
            const typeLabel = r.source || (r.type === 'airbnb' ? 'Airbnb' : 'Personnel');
            const showReason = r.reason && (!isSelectable
              || r.status === 'price_missing'
              || r.status === 'comment_missing'
              || r.status === 'price_comment_missing');
            return (
              <Card key={r.id} sx={{ mb: 1, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
                <CardContent sx={{ display: 'flex', gap: 2 }}>
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleToggleReservation(r.id)}
                    disabled={!isSelectable}
                    sx={{ mt: -0.5 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="subtitle1">
                        {r.giteName || 'Gîte inconnu'} · {formatDisplayDate(r.checkIn)} → {formatDisplayDate(r.checkOut)}
                      </Typography>
                      <Chip
                        icon={meta.icon}
                        label={meta.label}
                        color={meta.color}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {r.name ? `Nom: ${r.name}` : 'Nom non renseigné'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {typeLabel} · {r.payout != null ? `Payout: ${r.payout}€` : 'Payout: n/a'}
                    </Typography>
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
    </Box>
  );
}
