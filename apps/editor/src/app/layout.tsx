import type { ReactNode } from 'react';

// Global stylesheet for the ported color picker (ramp-stop swatches, popover,
// channel sliders — see apps/editor/src/controls/). Next's App Router only
// picks up global CSS imported from a layout/page file, not from a nested
// client component, so it lands here rather than beside the components it
// styles.
import '@/controls/controls.css';

export const metadata = { title: 'Shaders Editor' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
