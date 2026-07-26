/**
 * The two-column frame every component demo page uses: shader on the left in
 * a column capped at 896px, controls on the right in a sticky sidebar that
 * stacks below the shader under 1024px. The shader child keeps its own
 * [data-shader-demo] wrapper, which is what the Playwright visual suite
 * sizes against.
 */
import type { ReactNode } from 'react';

export function DemoLayout({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className="demo-layout">
      <div>{children}</div>
      <aside className="demo-layout-controls">{controls}</aside>
    </div>
  );
}
