import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Fade,
  Stack
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

/** Loader central élégant affiché durant la récupération des données */
function Loader({ steps = [], activeStep = 0, message }) {
  const baseProgress = steps.length ? (activeStep / steps.length) * 100 : 0;
  const progress = Math.min(baseProgress, 100);
  const isFinished = activeStep >= steps.length;

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3,
        px: 3
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant={isFinished ? 'determinate' : 'indeterminate'}
          value={progress}
          size={96}
          thickness={4}
          color="secondary"
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}
        >
          <Typography variant="h6" component="div" color="text.secondary">
            {isFinished ? 'Prêt' : `${Math.round(progress)}%`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {message || 'Initialisation...'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ width: '100%', maxWidth: 360 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          color="secondary"
          sx={{ mb: 2, height: 6, borderRadius: 999 }}
        />
        <Stack spacing={1.5}>
          {steps.map((label, index) => {
            const isCurrent = index === activeStep && !isFinished;
            const isComplete = index < activeStep;

            return (
              <Box
                key={label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  opacity: isComplete ? 0.7 : 1,
                  transition: 'opacity 0.3s ease'
                }}
              >
                <Box sx={{ width: 28, height: 28 }}>
                  {isComplete ? (
                    <CheckCircleIcon color="success" fontSize="medium" />
                  ) : isCurrent ? (
                    <Fade in timeout={600}>
                      <CircularProgress size={28} thickness={5} color="secondary" />
                    </Fade>
                  ) : (
                    <RadioButtonUncheckedIcon color="disabled" fontSize="medium" />
                  )}
                </Box>
                <Typography
                  variant="body1"
                  color={isComplete ? 'text.secondary' : 'text.primary'}
                  sx={{ fontWeight: isCurrent ? 600 : 400 }}
                >
                  {label}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

export default Loader;
