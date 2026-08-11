'use client';

import { useEffect, useState } from 'react';

import { useTheme } from 'next-themes';

// What each theme cycles to on click, and how it reads in the button label.
const THEME_CYCLE: Record<string, string> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
const THEME_LABEL: Record<string, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The theme is only knowable in the browser (next-themes reads it from
  // localStorage/media queries), so the server-rendered HTML and the first
  // client render must both show the theme-blind placeholder below — waiting
  // for the post-mount effect is what keeps hydration from mismatching. This
  // is next-themes' documented pattern, not an avoidable extra render.
  // react-doctor-disable-next-line react-doctor/no-initialize-state
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        style={{
          width: 32,
          height: 32,
          opacity: 0.4,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'transparent',
        }}
      />
    );
  }

  const cycle = () => {
    setTheme(THEME_CYCLE[theme ?? 'system'] ?? 'system');
  };

  const label = THEME_LABEL[theme ?? 'system'] ?? 'Auto';
  const icon = resolvedTheme === 'dark' ? '○' : '●';

  return (
    <button
      aria-label={`Theme: ${label} (click to cycle)`}
      onClick={cycle}
      style={{
        width: 32,
        height: 32,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-muted)',
        color: 'var(--fg)',
        cursor: 'pointer',
        fontSize: '0.85rem',
      }}
      title={`Theme: ${label}`}
    >
      {icon}
    </button>
  );
}
