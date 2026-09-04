import type { ReactNode } from 'react';

import { DocsShell } from '@/components/docs-shell/docs-shell';
import { SectionBanner } from '@/components/section-banner/section-banner';

export default function ComponentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionBanner title="Components" />
      <DocsShell>{children}</DocsShell>
    </>
  );
}
