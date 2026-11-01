/**
 * The Gallery's frame: the section banner and the docs shell that the
 * components pages use, with no design of its own until the author designs
 * the Gallery. The sidebar lists the components, which a composition is
 * built from.
 */
import type { ReactNode } from 'react';

import { DocsShell } from '@/components/docs-shell/docs-shell';
import { SectionBanner } from '@/components/section-banner/section-banner';

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionBanner title="Gallery" />
      <DocsShell section="components">{children}</DocsShell>
    </>
  );
}
