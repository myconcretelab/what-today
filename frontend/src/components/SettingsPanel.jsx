import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Card,
  CardContent,
  Chip,
  MenuItem,
  CircularProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { CARD_BG } from '../utils';
import {
  fetchPrices,
  savePrices,
  fetchTexts,
  saveTexts,
  fetchData,
  saveData,
  uploadHar
} from '../services/api';

const GITE_OPTIONS = ['phonsine', 'gree', 'edmond', 'liberte'];

export default function SettingsPanel({ panelBg, onBack }) {
  const theme = useTheme();
  const headerColor = theme.palette.getContrastText(panelBg || '#ffffff');
  const [prices, setPrices] = useState([]);
  const [texts, setTexts] = useState([]);
  const fileInputRef = useRef(null);
  const harInputRef = useRef(null);
  const [isHarUploading, setIsHarUploading] = useState(false);
  const [harUploadOk, setHarUploadOk] = useState(null); // null | true | false
  const [harUploadMsg, setHarUploadMsg] = useState('');

  useEffect(() => {
    fetchPrices()
      .then(data => setPrices(data))
      .catch(() => {});
    fetchTexts()
      .then(data => setTexts(data))
      .catch(() => {});
  }, []);

  const handleAmountChange = (idx, value) => {
    const next = [...prices];
    next[idx].amount = Number(value);
    setPrices(next);
  };

  const handleGitesChange = (idx, value) => {
    const next = [...prices];
    next[idx].gites = value;
    setPrices(next);
  };

  const addPrice = () => {
    setPrices([...prices, { amount: 0, gites: [] }]);
  };

  const removePrice = idx => {
    setPrices(prices.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    savePrices(prices).catch(() => {});
  };

  const handleTitleChange = (idx, value) => {
    const next = [...texts];
    next[idx].title = value;
    setTexts(next);
  };

  const handleTextChange = (idx, value) => {
    const next = [...texts];
    next[idx].text = value;
    setTexts(next);
  };

  const addText = () => {
    setTexts([...texts, { title: '', text: '' }]);
  };

  const removeText = idx => {
    setTexts(texts.filter((_, i) => i !== idx));
  };

  const handleSaveTexts = () => {
    saveTexts(texts).catch(() => {});
  };

  const handleExportData = async () => {
    try {
      const data = await fetchData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // ignore
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportData = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await saveData(data);
      setPrices(data.prices || []);
      setTexts(data.texts || []);
    } catch (err) {
      // ignore
    }
  };

  const handleHarClick = () => {
    harInputRef.current?.click();
  };

  const handleImportHar = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setHarUploadOk(null);
      setHarUploadMsg('');
      setIsHarUploading(true);
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await uploadHar(json);
      if (result && result.success) {
        setHarUploadOk(true);
        setHarUploadMsg('Fichier HAR enregistré sur le serveur.');
      } else {
        setHarUploadOk(false);
        setHarUploadMsg('Le serveur a répondu sans succès.');
      }
    } catch (err) {
      setHarUploadOk(false);
      setHarUploadMsg('Échec de l\'envoi du fichier HAR.');
    } finally {
      setIsHarUploading(false);
      // reset input so selecting the same file again triggers change
      e.target.value = '';
    }
  };

  return (
    <Box sx={{ p: 2, pl: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={onBack} size="large" sx={{ color: headerColor }}>
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Typography variant="h6" sx={{ color: headerColor }}>Réglages</Typography>
      </Box>
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Gestion des prix
          </Typography>      
          {prices.map((p, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TextField
                type="number"
                label="Prix"
                value={p.amount}
                onChange={e => handleAmountChange(idx, e.target.value)}
                sx={{ width: 100 }}
              />
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Gîtes</InputLabel>
                <Select
                  multiple
                  value={p.gites}
                  onChange={e => handleGitesChange(idx, e.target.value)}
                  input={<OutlinedInput label="Gîtes" />}
                  renderValue={selected => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map(value => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                >
                  {GITE_OPTIONS.map(g => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => removePrice(idx)}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: "flex", alignItems: "center", mt: 4, mb: 2 }}>
            <Button startIcon={<AddIcon />} onClick={addPrice} sx={{ mr: 1 }}>
              Ajouter
            </Button>
            <Button variant="contained" onClick={handleSave}>
              Sauvegarder
            </Button>
          </Box>
          </CardContent>
      </Card>
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mt: 4, mb: 2 }}>
            <Typography variant="h6"  sx={{ mb: 2 }}>
              Textes SMS
            </Typography>
            <Typography variant="caption" sx={{ ml: 2 }}>
              Variables: {'{dateDebut}'}, {'{dateFin}'}, {'{nom}'}, {'{nbNuits}'}
            </Typography>
          </Box>    
          {texts.map((t, idx) => (
            <Box key={idx} sx={{ mb: 5 }}>
              <TextField
                label="Titre"
                value={t.title}
                onChange={e => handleTitleChange(idx, e.target.value)}
                sx={{ mr: 1 }}
              />
              <IconButton onClick={() => removeText(idx)}>
                <DeleteIcon />
              </IconButton>
              <TextField
                multiline
                rows={2}
                fullWidth
                value={t.text}
                onChange={e => handleTextChange(idx, e.target.value)}
                sx={{ mt: 1 }}
              />
            </Box>
          ))}
          <Box sx={{ display: "flex", alignItems: "center", mt: 4, mb: 2 }}>
            <Button startIcon={<AddIcon />} onClick={addText} sx={{ mr: 1 }}>
              Ajouter
            </Button>
            <Button variant="contained" onClick={handleSaveTexts} sx={{ mr: 1 }}>
              Sauvegarder
            </Button>
          </Box>
        </CardContent>
      </Card> 
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleImportData}
      />
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
        <CardContent>
          <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Paramètres d'import/export des données
          </Typography>   
            <Button variant="outlined" onClick={handleImportClick} sx={{ mr: 1 }}>
              Importer
            </Button>
            <Button variant="contained" onClick={handleExportData}>
              Exporter
            </Button>
          </Box>
        </CardContent>
      </Card>
      <input
        type="file"
        accept=".har,application/json"
        ref={harInputRef}
        style={{ display: 'none' }}
        onChange={handleImportHar}
      />
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: CARD_BG }}>
        <CardContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Import du fichier HAR Airbnb
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Le fichier sera enregistré sous "www.airbnb.fr.har" dans le dossier backend.
            </Typography>
            <Button
              variant="contained"
              onClick={handleHarClick}
              disabled={isHarUploading}
              startIcon={isHarUploading ? undefined : null}
            >
              {isHarUploading ? (
                <>
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                  Import en cours…
                </>
              ) : (
                'Importer un fichier .har'
              )}
            </Button>
            {/* Feedback message */}
            {harUploadOk != null && (
              <Typography
                variant="body2"
                sx={{ mt: 1, color: harUploadOk ? 'success.main' : 'error.main' }}
              >
                {harUploadMsg}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
