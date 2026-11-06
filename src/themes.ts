export const themes = [
  { id: 'ocean', name: 'Ocean' },
  { id: 'forest', name: 'Forest' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'paper', name: 'Paper' },
] as const;

export type MapTheme = typeof themes[number]['id'];
export function isMapTheme(value: unknown): value is MapTheme {
  return themes.some(theme => theme.id === value);
}
