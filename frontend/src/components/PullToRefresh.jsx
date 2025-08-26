import React, { useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

const THRESHOLD = 60;

function PullToRefresh({ onRefresh, children, sx = {} }) {
  const ref = useRef(null);
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = e => {
    if (ref.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = e => {
    if (ref.current.scrollTop === 0) {
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        e.preventDefault();
        setPull(diff);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pull > THRESHOLD) {
      setRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false);
        setPull(0);
      });
    } else {
      setPull(0);
    }
  };

  return (
    <Box
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', ...sx }}
    >
      <Box
        sx={{
          height: pull,
          display: pull > 0 || refreshing ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {refreshing && <CircularProgress size={24} sx={{ color: '#f48fb1' }} />}
      </Box>
      {children}
    </Box>
  );
}

export default PullToRefresh;
