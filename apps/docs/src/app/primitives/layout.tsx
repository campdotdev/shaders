import type { ReactNode } from 'react';

import { DocsShell } from '@/components/docs-shell/docs-shell';

export default function PrimitivesLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
