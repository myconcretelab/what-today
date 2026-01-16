import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchData, saveData } from './services/api';

// Storage keys
const THEMES_KEY = 'wt-themes';
const ACTIVE_THEME_KEY = 'wt-active-theme';

// Default theme definition
export const DEFAULT_THEME = {
  id: 'default',
  name: 'Default',
  events: {
    arrival: '#780000',
    depart: '#669bbc',
    both: '#c1121f',
    done: '#003049'
  },
  cardBg: '#f3f3f3ff',
  ticketBg: '#ffffff',
  panelColors: ['#b0c4b1', '#4a5759', '#ffa69e', '#aed9e0', '#e1c7a2'],
  text: {
    primary: '#1f2937',
    title: '#111827',
    caption: '#4b5563'
  },
  menu: {
    bg: '#5b656aff',
    icon: '#ffffff',
    indicator: '#ffffff'
  }
};

function loadThemes() {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    if (!raw) return [DEFAULT_THEME];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_THEME];
    return parsed;
  } catch {
    return [DEFAULT_THEME];
  }
}

function saveThemes(themes) {
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  } catch {
    // ignore
  }
}

function loadActiveThemeId() {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY) || 'default';
  } catch {
    return 'default';
  }
}

function saveActiveThemeId(id) {
  try {
    localStorage.setItem(ACTIVE_THEME_KEY, id);
  } catch {
    // ignore
  }
}

const ThemeColorsContext = createContext(null);

export function ThemeColorsProvider({ children }) {
  const [themes, setThemes] = useState(() => loadThemes());
  const [activeId, setActiveId] = useState(() => loadActiveThemeId());
  const [serverSnapshot, setServerSnapshot] = useState(null); // last data.json content

  // Ensure default theme exists
  useEffect(() => {
    setThemes(prev => {
      if (prev.length === 0) return [DEFAULT_THEME];
      return prev;
    });
  }, []);

  useEffect(() => {
    saveThemes(themes);
    // do not spam server on every keystroke; client-side persistence only here
  }, [themes]);

  useEffect(() => {
    saveActiveThemeId(activeId);
  }, [activeId]);

  // Load themes from server data.json if present
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData();
        setServerSnapshot(data || {});
        if (Array.isArray(data?.themes) && data.themes.length > 0) {
          setThemes(data.themes);
        }
        if (data?.activeThemeId) {
          setActiveId(data.activeThemeId);
        }
      } catch {
        // ignore network errors; fallback to localStorage
      }
    })();
  }, []);

  const theme = useMemo(() => {
    return themes.find(t => t.id === activeId) || themes[0] || DEFAULT_THEME;
  }, [themes, activeId]);

  const addTheme = (base) => {
    const id = `theme_${Date.now()}`;
    const next = { ...(base || DEFAULT_THEME), id, name: (base?.name ? `${base.name} (copy)` : 'Custom') };
    setThemes(prev => [...prev, next]);
    setActiveId(id);
    return id;
  };

  const removeTheme = (id) => {
    setThemes(prev => prev.filter(t => t.id !== id));
    setActiveId(prev => (prev === id ? 'default' : prev));
  };

  const renameTheme = (id, name) => {
    setThemes(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
  };

  const updateTheme = (id, patch) => {
    setThemes(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  };

  const updateThemeDeep = (id, path, value) => {
    setThemes(prev => prev.map(t => {
      if (t.id !== id) return t;
      // naive deep update for 2-level paths like 'events.arrival' or 'text.title'
      const parts = path.split('.');
      if (parts.length === 1) return { ...t, [parts[0]]: value };
      const [k1, k2] = parts;
      return { ...t, [k1]: { ...(t[k1] || {}), [k2]: value } };
    }));
  };

  const value = {
    themes,
    theme,
    activeId,
    setActiveId,
    addTheme,
    removeTheme,
    renameTheme,
    updateTheme,
    updateThemeDeep,
    async saveThemesToServer() {
      try {
        const base = serverSnapshot || (await fetchData());
        const next = {
          ...(base && typeof base === 'object' ? base : {}),
          themes,
          activeThemeId: activeId
        };
        await saveData(next);
        setServerSnapshot(next);
        return { success: true };
      } catch (e) {
        return { success: false, error: e?.message || 'save failed' };
      }
    }
  };

  return (
    <ThemeColorsContext.Provider value={value}>{children}</ThemeColorsContext.Provider>
  );
}

export function useThemeColors() {
  const ctx = useContext(ThemeColorsContext);
  if (!ctx) throw new Error('useThemeColors must be used within ThemeColorsProvider');
  return ctx;
}
