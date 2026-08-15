export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';

/**
 * Applied before first paint by the inline script in the root layout, and again
 * by the toggle. Kept as a string because it has to run synchronously in
 * `<head>` — anything React-driven would run after the first paint and flash.
 *
 * "system" is the default and is stored as an absent key, so a user who never
 * touches the toggle keeps following their OS even if it changes mid-session.
 */
export const THEME_SCRIPT = `try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},m=matchMedia('(prefers-color-scheme: dark)');
var a=function(){var s=localStorage.getItem(k);
document.documentElement.classList.toggle('dark',s==='dark'||(s!=='light'&&m.matches));};
a();m.addEventListener('change',a);}catch(e){}`;

/**
 * localStorage is external mutable state, so the toggle reads it through
 * `useSyncExternalStore` rather than an effect — that keeps SSR honest (the
 * server snapshot is always "system") without assigning state during render.
 */
const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  // Another tab writing the key should move this one's toggle too.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getThemeSnapshot(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** The server cannot know the preference; "system" is the documented default. */
export function getServerThemeSnapshot(): Theme {
  return 'system';
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
  else localStorage.setItem(THEME_STORAGE_KEY, theme);

  const dark =
    theme === 'dark' ||
    (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', dark);
  listeners.forEach((notify) => {
    notify();
  });
}
