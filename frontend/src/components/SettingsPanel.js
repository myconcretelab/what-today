import React, { useEffect, useState } from 'react';
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
  Chip,
  MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { fetchPrices, savePrices, fetchTexts, saveTexts } from '../services/api';

const GITE_OPTIONS = ['phonsine', 'gree', 'edmond', 'liberte'];

export default function SettingsPanel() {
  const [prices, setPrices] = useState([]);
  const [texts, setTexts] = useState([]);

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

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Réglages
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
      <Button startIcon={<AddIcon />} onClick={addPrice} sx={{ mr: 1 }}>
        Ajouter
      </Button>
      <Button variant="contained" onClick={handleSave}>
        Sauvegarder
      </Button>
      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
        Textes SMS
      </Typography>
      {texts.map((t, idx) => (
        <Box key={idx} sx={{ mb: 1 }}>
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
      <Button startIcon={<AddIcon />} onClick={addText} sx={{ mr: 1 }}>
        Ajouter
      </Button>
      <Button variant="contained" onClick={handleSaveTexts} sx={{ mr: 1 }}>
        Sauvegarder
      </Button>
      <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
        Variables: {'{dateDebut}'}, {'{dateFin}'}, {'{nom}'}, {'{nbNuits}'}
      </Typography>
    </Box>
  );
}

