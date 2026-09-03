import type { ReactNode } from 'react';

import { DocsShell } from '@/components/docs/DocsShell';
import { SectionBanner } from '@/components/section-banner/section-banner';

export default function ComponentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionBanner title="Components" />
      <DocsShell>{children}</DocsShell>
    </>
  );
}
