// Returns a CSS-custom-property style object for the current theme,
// ported 1:1 from the original prototype's applyVars() logic.
export function getThemeVars(dark, sidebarDark) {
  const light = {
    '--bg': '#eef0f3', '--surface': '#ffffff', '--surface-2': '#f7f8fa', '--surface-3': '#f1f3f6',
    '--border': '#e6e8ec', '--border-strong': '#d5d9e0', '--fg': '#0f172a', '--fg-2': '#334155',
    '--muted': '#64748b', '--faint': '#94a3b8', '--primary': '#0f172a', '--primary-fg': '#ffffff',
    '--brand': '#0891b2', '--brand-soft': '#ecfeff',
    '--shadow': '0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.07)',
    '--shadow-lg': '0 16px 40px -14px rgba(15,23,42,.2)',
  };
  const darkVars = {
    '--bg': '#080b12', '--surface': '#111725', '--surface-2': '#0d1420', '--surface-3': '#182031',
    '--border': 'rgba(255,255,255,.08)', '--border-strong': 'rgba(255,255,255,.15)', '--fg': '#e8ecf3', '--fg-2': '#c2cbd8',
    '--muted': '#8b98ab', '--faint': '#5f6b7e', '--primary': '#22d3ee', '--primary-fg': '#04121a',
    '--brand': '#22d3ee', '--brand-soft': 'rgba(34,211,238,.12)',
    '--shadow': '0 1px 2px rgba(0,0,0,.4)', '--shadow-lg': '0 24px 50px -14px rgba(0,0,0,.65)',
  };

  const t = dark ? darkVars : light;

  let sb;
  if (dark) {
    sb = { '--sb-bg': '#0b1119', '--sb-fg': '#e2e8f0', '--sb-muted': '#8b98ab', '--sb-section': '#5f6b7e', '--sb-border': 'rgba(255,255,255,.07)', '--sb-hover': 'rgba(255,255,255,.05)', '--sb-active-bg': 'rgba(34,211,238,.14)', '--sb-active-fg': '#22d3ee' };
  } else if (sidebarDark) {
    sb = { '--sb-bg': '#0f1522', '--sb-fg': '#dbe2ea', '--sb-muted': '#8492a6', '--sb-section': '#5a6779', '--sb-border': 'rgba(255,255,255,.07)', '--sb-hover': 'rgba(255,255,255,.055)', '--sb-active-bg': 'rgba(34,211,238,.15)', '--sb-active-fg': '#22d3ee' };
  } else {
    sb = { '--sb-bg': '#ffffff', '--sb-fg': '#334155', '--sb-muted': '#64748b', '--sb-section': '#94a3b8', '--sb-border': '#e6e8ec', '--sb-hover': '#f4f5f7', '--sb-active-bg': '#ecfeff', '--sb-active-fg': '#0891b2' };
  }

  return { ...t, ...sb };
}
