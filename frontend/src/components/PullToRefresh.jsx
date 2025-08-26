import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

const THRESHOLD = 60;

function PullToRefresh({ onRefresh, children, sx = {} }) {
  const ref = useRef(null);
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const setPullState = value => {
    pullRef.current = value;
    setPull(value);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const handleTouchStart = e => {
      if (el.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = e => {
      if (el.scrollTop === 0) {
        const diff = e.touches[0].clientY - startY.current;
        if (diff > 0) {
          if (e.cancelable) {
            e.preventDefault();
          }
          setPullState(diff);
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullRef.current > THRESHOLD) {
        setRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => {
          setRefreshing(false);
          setPullState(0);
        });
      } else {
        setPullState(0);
      }
    };

    el.addEventListener('touchstart', handleTouchStart);
    // Use a non-passive listener to allow preventDefault on mobile browsers
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh]);

  return (
    <Box
      ref={ref}
      sx={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', ...sx }}
    >
      <Box
        sx={{
          height: pull,
          display: pull > 0 || refreshing ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#424242',
          width: '100%'
        }}
      >
        {refreshing && <CircularProgress size={24} sx={{ color: '#f48fb1' }} />}
      </Box>
      {children}
    </Box>
  );
}

export default PullToRefresh;
