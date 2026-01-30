import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSettings, saveSettings } from '@/utils/storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(getSystemTheme());

  // Lade Theme aus Storage beim Start
  useEffect(() => {
    getSettings().then(settings => {
      setThemeState(settings.theme);
    });
  }, []);

  // Aktualisiere resolved theme wenn sich theme ändert
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(getSystemTheme());
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    // Listener für System-Theme-Änderungen
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        setResolvedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Wende Theme auf document an
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveSettings({ theme: newTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
