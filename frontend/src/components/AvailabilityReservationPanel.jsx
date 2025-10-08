// Import UI building blocks and shared hooks
import React from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Avatar,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import SmsIcon from '@mui/icons-material/Sms';
import { useAvailabilityContext } from './AvailabilityProvider.jsx';
import { useThemeColors } from '../theme.jsx';

export function AvailabilityReservationPanel({ onBack, panelBg }) {
  // Gather reservation data and actions from the shared availability context
  const {
    arrival,
    departure,
    selectedGite,
    name,
    setName,
    phone,
    singleBeds,
    setSingleBeds,
    doubleBeds,
    setDoubleBeds,
    adultCount,
    setAdultCount,
    childCount,
    setChildCount,
    includeBedding,
    setIncludeBedding,
    info,
    handlePhoneChange,
    handleSave,
    saving,
    saveError,
    airbnbUrl,
    reservationText,
    selectedPrice,
    setSelectedPrice,
    prices,
    texts,
    selectedTexts,
    setSelectedTexts,
    savedForRange,
    nightCount
  } = useAvailabilityContext();
  const theme = useTheme();
  const headerColor = theme.palette.getContrastText(panelBg || '#ffffff');
  const { theme: colorTheme } = useThemeColors();

  return (
    <Box sx={{ p: 2, pl: { xs: 1, sm: 2 } }}>
      {/* Header with back navigation and time range */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={onBack} size="large" sx={{ color: headerColor }}>
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Typography variant="h6" sx={{ color: headerColor }}>Réservation</Typography>
      </Box>
      {selectedGite && (
        <Typography
          variant="subtitle2"
          sx={{ color: 'grey.600', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {selectedGite.name} — {arrival.format('DD/MM/YYYY')} au {departure.format('DD/MM/YYYY')}
          <Chip label={`${nightCount} nuits`} size="small" sx={{ bgcolor: '#f48fb1', color: '#fff' }} />
        </Typography>
      )}

      {/* Section 1: Split into information capture and action panels */}
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            1 - Enter les informations
          </Typography>
          <TextField
            label="Téléphone"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="00 00 00 00 00"
            inputProps={{ inputMode: 'numeric' }}
            sx={{ mb: 1 }}
          />
          <TextField
            label="Nom/prénom"
            value={name}
            onChange={e => setName(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <TextField
              select
              label="Adultes"
              value={adultCount}
              onChange={e => setAdultCount(Number(e.target.value))}
              sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <MenuItem key={i} value={i}>
                  {i}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Enfants"
              value={childCount}
              onChange={e => setChildCount(Number(e.target.value))}
              sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
            >
              {Array.from({ length: 11 }, (_, i) => (
                <MenuItem key={i} value={i}>
                  {i}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField
            select
            label="Prix/nuit"
            value={selectedPrice}
            onChange={e => setSelectedPrice(e.target.value)}
            sx={{ mb: 1, minWidth: 120 }}
          >
            {selectedGite &&
              prices
                .filter(p => p.gites.includes(selectedGite.id))
                .map(p => (
                  <MenuItem key={p.amount} value={String(p.amount)}>
                    {p.amount}€
                  </MenuItem>
                ))}
            <MenuItem value="other">autre</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={includeBedding} onChange={e => setIncludeBedding(e.target.checked)} />}
            label="Draps"
            sx={{ mb: 1 }}
          />
          {includeBedding && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <TextField
                select
                label="Lit(s) simple"
                value={singleBeds}
                onChange={e => setSingleBeds(Number(e.target.value))}
                sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {i}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Lit(s) double"
                value={doubleBeds}
                onChange={e => setDoubleBeds(Number(e.target.value))}
                sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
              >
                {Array.from({ length: 7 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {i}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            2 - Enregistrer Google & Bloquer Airbnb
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            value={info}
            InputProps={{ readOnly: true }}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              color={saveError ? 'error' : saving ? 'warning' : 'primary'}
              onClick={handleSave}
              disabled={saving || savedForRange}
            >
              {saving && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
              {saveError ? 'Erreur !' : '1 Sauvegarder Google Sheets'}
            </Button>
            <Button
              variant="contained"
              size="small"
              component={airbnbUrl ? 'a' : 'button'}
              href={airbnbUrl || undefined}
              target={airbnbUrl ? '_blank' : undefined}
              rel={airbnbUrl ? 'noopener' : undefined}
              disabled={!airbnbUrl}
              sx={{ bgcolor: '#000', color: '#fff', '&:hover': { bgcolor: '#333' } }}
            >
              2 Ouvrir calendrier Airbnb
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Section 2: Prepare and send SMS communication */}
      <Card sx={{ mb: 2, boxShadow: 'none', bgcolor: colorTheme.cardBg }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            3 - Envoyer un SMS de confirmation
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', mb: 1 }}>
            {texts.map((t, idx) => (
              <FormControlLabel
                key={idx}
                control={
                  <Switch
                    checked={selectedTexts.includes(idx)}
                    onChange={e =>
                      setSelectedTexts(
                        e.target.checked
                          ? [...selectedTexts, idx]
                          : selectedTexts.filter(i => i !== idx)
                      )
                    }
                  />
                }
                label={t.title}
              />
            ))}
            {(() => {
              const digits = (phone || '').replace(/\D/g, '');
              const smsBody = reservationText || '';
              const smsHref = `sms:${digits}?&body=${encodeURIComponent(smsBody)}`;
              const telHref = `tel:${digits}`;
              return (
                <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 48, height: 48, border: 'none' }}>
                    <IconButton component="a" href={telHref} aria-label="Call" sx={{ color: 'inherit' }}>
                      <PhoneIcon />
                    </IconButton>
                  </Avatar>
                  <Avatar sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', width: 48, height: 48, border: 'none' }}>
                    <IconButton component="a" href={smsHref} aria-label="Send SMS" sx={{ color: 'inherit' }}>
                      <SmsIcon />
                    </IconButton>
                  </Avatar>
                </Box>
              );
            })()}
          </Box>
          <Box sx={{ border: '1px solid', borderColor: 'grey.400', borderRadius: 1, p: 2, mb: 1 }}>
            <Typography sx={{ whiteSpace: 'pre-line' }}>{reservationText}</Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigator.clipboard.writeText(reservationText)}
            sx={{ mb: 2 }}
          >
            Copier
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
