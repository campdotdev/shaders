import type { ReactNode } from 'react';

import { DocsShell } from '@/components/docs-shell/docs-shell';

export default function DocsContentLayout({ children }: { children: ReactNode }) {
  return <DocsShell section="docs">{children}</DocsShell>;
}
