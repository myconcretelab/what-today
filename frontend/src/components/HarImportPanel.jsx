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
import { previewHar, importHarReservations } from '../services/api';
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
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [harStage, setHarStage] = useState('idle');
  const [importStage, setImportStage] = useState('idle');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);

  const harSteps = [
    'Lecture du fichier HAR',
    'Analyse et extraction',
    'Comparaison avec la feuille'
  ];

  const importSteps = [
    'Préparation de la sélection',
    'Insertion dans Google Sheets',
    'Finalisation (tri, séparateurs, surlignage)'
  ];

  const harStageMessage = {
    reading: 'Lecture du fichier HAR en cours...',
    parsing: 'Analyse et extraction des réservations...',
    comparing: 'Comparaison avec la feuille Google Sheets...',
    error: 'Une erreur est survenue pendant le traitement du HAR.'
  }[harStage];

  const importStageMessage = {
    preparing: 'Préparation de l\'import...',
    inserting: 'Insertion des lignes dans Google Sheets...',
    error: 'Une erreur est survenue pendant l\'import.'
  }[importStage];

  const harActiveStep = (() => {
    switch (harStage) {
      case 'reading':
        return 0;
      case 'parsing':
        return 1;
      case 'comparing':
        return 2;
      case 'done':
        return harSteps.length;
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

  const showHarProgress = isParsing || harStage === 'error';
  const showImportProgress = isImporting || importStage === 'error';

  const selectableCount = useMemo(() => {
    if (!preview?.reservations) return 0;
    return preview.reservations.filter(r => r.status === 'new').length;
  }, [preview]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedIds).filter(Boolean).length;
  }, [selectedIds]);

  const displayedReservations = useMemo(() => {
    if (!preview?.reservations) return [];
    return preview.reservations.filter(r => (showAll ? true : r.status === 'new'));
  }, [preview, showAll]);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setImportResult(null);
    setIsParsing(true);
    setHarStage('reading');
    setImportStage('idle');
    try {
      const text = await file.text();
      setHarStage('parsing');
      const json = JSON.parse(text);
      setHarStage('comparing');
      const result = await previewHar(json);
      if (!result?.success) {
        throw new Error('Réponse invalide du serveur.');
      }
      setPreview(result);
      const nextSelected = {};
      (result.reservations || []).forEach(r => {
        if (r.status === 'new') nextSelected[r.id] = true;
      });
      setSelectedIds(nextSelected);
      setHarStage('done');
    } catch (err) {
      setPreview(null);
      setSelectedIds({});
      setError('Impossible de lire le fichier HAR.');
      setHarStage('error');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleToggleAll = () => {
    if (!preview?.reservations) return;
    const nextSelected = {};
    preview.reservations.forEach(r => {
      if (r.status === 'new') nextSelected[r.id] = true;
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
        Import HAR Airbnb
      </Typography>

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Charger un fichier HAR, comparer les réservations, puis valider l\'import.
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

      {showHarProgress && (
        <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Traitement du HAR
            </Typography>
            {harStageMessage && (
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                {harStageMessage}
              </Typography>
            )}
            <Stepper activeStep={harActiveStep} orientation="vertical">
              {harSteps.map(label => (
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
              <Chip label={`Total: ${preview.counts?.total || 0}`} />
              <Chip color="success" label={`Nouvelles: ${preview.counts?.new || 0}`} />
              <Chip color="warning" label={`Déjà présentes: ${preview.counts?.existing || 0}`} />
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
                {showAll ? 'Afficher les nouvelles uniquement' : 'Afficher toutes les réservations'}
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
            const isSelectable = r.status === 'new';
            const isChecked = !!selectedIds[r.id];
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
                      {r.type === 'airbnb' ? 'Airbnb' : 'Personnel'} · {r.payout != null ? `Payout: ${r.payout}€` : 'Payout: n/a'}
                    </Typography>
                    {r.comment && (
                      <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8 }}>
                        Commentaire: {r.comment}
                      </Typography>
                    )}
                    {r.reason && !isSelectable && (
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
                {selectableCount} réservations nouvelles détectées.
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
                Import terminé: {importResult.inserted} ajout(s), {importResult.skipped?.duplicate || 0} doublon(s) ignoré(s).
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
