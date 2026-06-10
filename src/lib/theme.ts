export interface ThemePreset {
  label: string;
  variables: Record<string, string>;
}

export const THEMES: Record<string, ThemePreset> = {
  default: {
    label: 'Navy',
    variables: {
      '--primary': '224 43% 20%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '234 50% 85%',
      '--secondary-foreground': '234 70% 19%',
      '--accent': '234 60% 95%',
      '--accent-foreground': '234 60% 32%',
      '--ring': '234 60% 32%',
      // Status
      '--status-success': '142 76% 36%',
      '--status-success-foreground': '142 76% 36%',
      '--status-success-bg': '142 76% 92%',
      '--status-warning': '38 92% 50%',
      '--status-warning-foreground': '38 92% 40%',
      '--status-warning-bg': '38 92% 95%',
      '--status-error': '0 84% 60%',
      '--status-error-foreground': '0 72% 50%',
      '--status-error-bg': '0 84% 95%',
      '--status-info': '217 91% 60%',
      '--status-info-foreground': '217 91% 45%',
      '--status-info-bg': '217 91% 95%',
      '--status-purple': '270 70% 60%',
      '--status-purple-foreground': '270 70% 50%',
      '--status-purple-bg': '270 70% 95%',
      '--status-indigo': '230 70% 55%',
      '--status-indigo-foreground': '230 70% 50%',
      // Charts
      '--chart-cash': '142 76% 36%',
      '--chart-mp': '217 91% 60%',
      '--chart-cost': '0 84% 60%',
      '--chart-orange': '25 95% 53%',
      '--chart-amber': '45 93% 47%',
      '--chart-purple': '270 70% 60%',
      '--chart-indigo': '230 70% 55%',
    },
  },
};

export function setTheme(name: string) {
  const theme = THEMES[name];
  if (!theme) return;
  const root = document.documentElement;
  root.setAttribute('data-theme', name);
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function getTheme(): string {
  return document.documentElement.getAttribute('data-theme') || 'default';
}
