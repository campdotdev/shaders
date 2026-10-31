/**
 * The Gallery at /gallery: every composition as a card in the registry's
 * order (compositions/index.ts), linking to its page. The grid is plain until
 * the author designs the Gallery. The registry is three-free, so this page
 * reads it on the server and hands the documents to the client grid, which
 * plays a card live on hover.
 */
import type { Metadata } from 'next';

import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';
import { COMPOSITIONS } from '@/compositions';

import { GalleryGrid } from './gallery-grid';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Finished compositions of Shaders components, ready to tweak and copy.',
};

export default function GalleryPage() {
  return (
    <article>
      {/* The section banner prints "Gallery" as a paragraph, because it also
          sits over every composition page, where the composition's title is
          the h1. This gives the grid its h1 without a second visible title,
          as on the components index. */}
      <h1 className={visuallyHiddenStyles.srOnly}>Gallery</h1>
      <GalleryGrid compositions={COMPOSITIONS} />
    </article>
  );
}
