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
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Radio
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import { useThemeColors, DEFAULT_THEME } from '../theme.jsx';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  const {
    theme: colorTheme,
    themes,
    activeId,
    setActiveId,
    addTheme,
    removeTheme,
    renameTheme,
    updateThemeDeep,
    updateTheme,
    saveThemesToServer
  } = useThemeColors();
  
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

  // ---------------- Google Fonts management (primary font selector) ----------------
  const GOOGLE_FONTS = [
    {
      id: 'default',
      label: 'Par défaut (Museo)',
      href: '',
      stack: "'Museo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'inter',
      label: 'Inter',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&display=swap',
      stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'roboto',
      label: 'Roboto',
      href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
      stack: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'open-sans',
      label: 'Open Sans',
      href: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
      stack: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'lato',
      label: 'Lato',
      href: 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
      stack: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'montserrat',
      label: 'Montserrat',
      href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap',
      stack: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'source-sans-3',
      label: 'Source Sans 3',
      href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap',
      stack: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'poppins',
      label: 'Poppins',
      href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap',
      stack: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    },
    {
      id: 'merriweather',
      label: 'Merriweather (serif)',
      href: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap',
      stack: "'Merriweather', Georgia, 'Times New Roman', Times, serif"
    },
    {
      id: 'playfair',
      label: 'Playfair Display (serif)',
      href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap',
      stack: "'Playfair Display', Georgia, 'Times New Roman', Times, serif"
    }
  ];

  const FONT_FAMILY_KEY = 'wt-font-family';
  const FONT_LINK_KEY = 'wt-font-url';

  const [selectedFontId, setSelectedFontId] = useState(() => {
    try {
      return localStorage.getItem('wt-font-id') || 'default';
    } catch {
      return 'default';
    }
  });

  const applyFontSelection = (font) => {
    // Inject or update the Google Fonts link
    const linkId = 'wt-google-font';
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (font.href) {
      link.href = font.href;
    } else {
      // Remove href for default (local) font
      link.parentNode && link.parentNode.removeChild(link);
    }

    // Inject or update a style tag to override typography globally
    const styleId = 'wt-font-override';
    let style = document.getElementById(styleId);
    const css = `:root{--wt-font:${font.stack}} body, .MuiTypography-root{ font-family: var(--wt-font) !important; }`;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    } else {
      style.textContent = css;
    }

    // Persist
    try {
      localStorage.setItem('wt-font-id', font.id);
      localStorage.setItem(FONT_FAMILY_KEY, font.stack);
      if (font.href) localStorage.setItem(FONT_LINK_KEY, font.href); else localStorage.removeItem(FONT_LINK_KEY);
    } catch {}
  };

  useEffect(() => {
    const current = GOOGLE_FONTS.find(f => f.id === selectedFontId) || GOOGLE_FONTS[0];
    applyFontSelection(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (Array.isArray(data.themes)) {
        localStorage.setItem('wt-themes', JSON.stringify(data.themes));
        localStorage.setItem('wt-active-theme', data.activeThemeId || data.themes[0]?.id || 'default');
      }
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
      {/* Theme management moved to bottom */}

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
      {/* 3) Google Fonts - Sélection de la police principale */}
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Police principale (Google Fonts)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel>Police</InputLabel>
              <Select
                label="Police"
                value={selectedFontId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedFontId(id);
                  const f = GOOGLE_FONTS.find(x => x.id === id) || GOOGLE_FONTS[0];
                  applyFontSelection(f);
                }}
              >
                {GOOGLE_FONTS.map(f => (
                  <MenuItem key={f.id} value={f.id}>
                    <Box sx={{ fontFamily: f.stack }}>{f.label}</Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={() => {
                setSelectedFontId('default');
                applyFontSelection(GOOGLE_FONTS[0]);
              }}
            >
              Par défaut
            </Button>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
            Les titres restent en gras; les commentaires s'affichent en italique.
          </Typography>
        </CardContent>
      </Card>
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleImportData}
      />
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
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
      {/* Theme management at the bottom with accordion per theme */}
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Couleurs / Thèmes</Typography>
          </Box>
          {themes.map(t => (
            <Accordion key={t.id} disableGutters sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Radio
                    checked={activeId === t.id}
                    onChange={() => setActiveId(t.id)}
                    onClick={e => e.stopPropagation()}
                    inputProps={{ 'aria-label': 'Activer ce thème' }}
                  />
                  <Typography sx={{ flex: 1 }}>{t.name}</Typography>
                  {t.id !== 'default' && (
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); removeTheme(t.id); }}
                      aria-label="Supprimer le thème"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  {t.id === 'default' && (
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        // Reset only color-related fields; keep current name/activation
                        updateTheme(t.id, {
                          events: DEFAULT_THEME.events,
                          panelColors: DEFAULT_THEME.panelColors,
                          cardBg: DEFAULT_THEME.cardBg,
                          ticketBg: DEFAULT_THEME.ticketBg,
                          text: DEFAULT_THEME.text,
                          menu: DEFAULT_THEME.menu
                        });
                      }}
                      aria-label="Réinitialiser le thème par défaut"
                      title="Réinitialiser"
                    >
                      <RestoreIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
                  <TextField
                    label="Nom"
                    value={t.name}
                    onChange={e => renameTheme(t.id, e.target.value)}
                    sx={{ minWidth: 220 }}
                  />
                </Box>

                <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>Événements</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(180px, 1fr))' }, gap: 1, mb: 2 }}>
                  {[
                    ['arrival', 'Arrivée'],
                    ['depart', 'Départ'],
                    ['both', 'Arrivée + Départ'],
                    ['done', 'Terminé']
                  ].map(([key, label]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <TextField
                        type="color"
                        label={label}
                        value={(t.events && t.events[key]) || '#000000'}
                        onChange={e => updateThemeDeep(t.id, `events.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 130 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="HEX"
                        value={(t.events && t.events[key]) || ''}
                        onChange={e => updateThemeDeep(t.id, `events.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 140 } }}
                      />
                    </Box>
                  ))}
                </Box>

                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Panneaux (4)</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(200px, 1fr))' }, gap: 1, mb: 2 }}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <TextField
                        type="color"
                        label={`Panel ${i + 1}`}
                        value={t.panelColors?.[i] || '#ffffff'}
                        onChange={e => {
                          const arr = [...(t.panelColors || [])];
                          arr[i] = e.target.value;
                          updateTheme(t.id, { panelColors: arr });
                        }}
                        sx={{ width: { xs: '100%', sm: 130 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="HEX"
                        value={t.panelColors?.[i] || ''}
                        onChange={e => {
                          const arr = [...(t.panelColors || [])];
                          arr[i] = e.target.value;
                          updateTheme(t.id, { panelColors: arr });
                        }}
                        sx={{ width: { xs: '100%', sm: 140 } }}
                      />
                    </Box>
                  ))}
                </Box>

                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Fond des cartes</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    type="color"
                    label="CARD_BG"
                    value={t.cardBg || '#ffffff'}
                    onChange={e => updateTheme(t.id, { cardBg: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 130 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HEX"
                    value={t.cardBg || ''}
                    onChange={e => updateTheme(t.id, { cardBg: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 140 } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    type="color"
                    label="TICKET_BG"
                    value={t.ticketBg || '#ffffff'}
                    onChange={e => updateTheme(t.id, { ticketBg: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 130 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HEX"
                    value={t.ticketBg || ''}
                    onChange={e => updateTheme(t.id, { ticketBg: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 140 } }}
                  />
                </Box>

                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Couleurs de texte</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(200px, 1fr))' }, gap: 1 }}>
                  {[
                    ['primary', 'Texte'],
                    ['title', 'Titre'],
                    ['caption', 'Caption']
                  ].map(([key, label]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <TextField
                        type="color"
                        label={label}
                        value={(t.text && t.text[key]) || '#000000'}
                        onChange={e => updateThemeDeep(t.id, `text.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 130 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="HEX"
                        value={(t.text && t.text[key]) || ''}
                        onChange={e => updateThemeDeep(t.id, `text.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 140 } }}
                      />
                    </Box>
                  ))}
                </Box>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Menu</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(220px, 1fr))' }, gap: 1 }}>
                  {[
                    ['bg', 'Fond du menu'],
                    ['icon', 'Icônes'],
                    ['indicator', 'Cercle']
                  ].map(([key, label]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <TextField
                        type="color"
                        label={label}
                        value={(t.menu && t.menu[key]) || '#000000'}
                        onChange={e => updateThemeDeep(t.id, `menu.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 130 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="HEX"
                        value={(t.menu && t.menu[key]) || ''}
                        onChange={e => updateThemeDeep(t.id, `menu.${key}`, e.target.value)}
                        sx={{ width: { xs: '100%', sm: 140 } }}
                      />
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addTheme(colorTheme)}>
              Nouveau thème
            </Button>
            <Button size="small" variant="outlined" onClick={() => document.getElementById('wt-import-themes')?.click()}>
              Importer thèmes
            </Button>
            <Button size="small" variant="outlined" onClick={() => {
              const payload = { themes, activeThemeId: activeId };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'themes.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>
              Exporter thèmes
            </Button>
            <Button size="small" color="success" variant="contained" onClick={() => saveThemesToServer()}>
              Enregistrer sur le serveur
            </Button>
          </Box>
          <input
            id="wt-import-themes"
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async e => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const json = JSON.parse(text);
                if (Array.isArray(json?.themes)) {
                  const nextThemes = json.themes;
                  const nextActive = json.activeThemeId || nextThemes[0]?.id || 'default';
                  localStorage.setItem('wt-themes', JSON.stringify(nextThemes));
                  localStorage.setItem('wt-active-theme', nextActive);
                  window.location.reload();
                }
              } catch {}
              finally {
                e.target.value = '';
              }
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
