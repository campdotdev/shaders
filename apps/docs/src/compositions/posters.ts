/**
 * Where each composition's poster lives under public/.
 * scripts/build-posters.sh captures it from the default preset's golden
 * file, default.tsx, so the path derives from the slug alone.
 */

/** The 3:2 poster the composition page and the Gallery card show before a frame. */
export const compositionPoster = (slug: string) => `/posters/gallery/${slug}.jpg`;
