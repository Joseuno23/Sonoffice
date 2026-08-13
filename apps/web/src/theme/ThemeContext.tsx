import { createContext, useContext, useEffect, useState } from 'react';
import { getThemeVars } from './themeVars';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('son_dark') === '1');
  const [sidebarDark, setSidebarDark] = useState(() => localStorage.getItem('son_sbdark') !== '0');

  useEffect(() => {
    localStorage.setItem('son_dark', dark ? '1' : '0');
  }, [dark]);
  useEffect(() => {
    localStorage.setItem('son_sbdark', sidebarDark ? '1' : '0');
  }, [sidebarDark]);

  const vars = getThemeVars(dark, sidebarDark);

  return (
    <ThemeContext.Provider
      value={{
        dark,
        sidebarDark,
        toggleDark: () => setDark((d) => !d),
        toggleSidebarTheme: () => setSidebarDark((s) => !s),
        vars,
      }}
    >
      <div
        style={{
          ...vars,
          minHeight: '100vh',
          background: 'var(--bg,#eef0f3)',
          color: 'var(--fg,#0f172a)',
          fontFamily: "'Inter',system-ui,sans-serif",
          fontSize: '14px',
          lineHeight: 1.5,
          transition: 'background .35s ease,color .35s ease',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
