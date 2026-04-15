export interface ThemePreset {
  label: string;
  variables: Record<string, string>;
}

export const THEMES: Record<string, ThemePreset> = {
  default: {
    label: 'Navy',
    variables: {
      '--primary': '234 70% 19%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '234 50% 85%',
      '--secondary-foreground': '234 70% 19%',
      '--accent': '234 60% 95%',
      '--accent-foreground': '234 60% 32%',
      '--ring': '234 60% 32%',
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
