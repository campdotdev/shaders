/**
 * Where each composition's poster and thumbnail live under public/.
 * scripts/build-posters.sh captures the poster from the composition's
 * Default golden file and cuts the thumbnail from it, so both paths derive
 * from the slug alone.
 */

/** The 3:2 poster the composition page and the Gallery card show before a frame. */
export const compositionPoster = (slug: string) => `/posters/gallery/${slug}.jpg`;

/** The square thumbnail the "Used in" strip shows. */
export const compositionThumbnail = (slug: string) => `/posters/gallery/${slug}.thumb.webp`;
