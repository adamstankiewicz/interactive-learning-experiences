'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { applyTheme, getServerThemeSnapshot, getThemeSnapshot, subscribeTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * The server cannot know the stored preference, so the group's highlight
 * starts on "system" and adopts the real value on hydration via
 * `useSyncExternalStore` — no effect, no render-phase `setState`. The document
 * class itself is already correct from the pre-paint script in the root
 * layout, so there is never a flash of the wrong theme regardless.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[theme]}
      onValueChange={(value) => {
        const next = value[0] as Theme | undefined;
        if (next) applyTheme(next); // ignore toggling the active option off
      }}
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
          <Icon aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
