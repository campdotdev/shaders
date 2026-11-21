/**
 * PhotoSource's fit, kept free of three so the docs' Node vitest can check
 * it. It answers how much of the photo the canvas shows along each axis,
 * which PhotoSource writes to a uniform that crops the texture.
 */

/**
 * The share of the photo the canvas shows along x and along y, from 0 to 1.
 *
 * To cover a box, a photo `photoAspect` times as wide as it is tall must be
 * max(width, height * photoAspect) CSS pixels wide. Without a frame, the
 * photo takes that width for the canvas: a plain cover fit, which scales
 * with the canvas. With a frame, it takes the larger of that width for the
 * frame and for the canvas. A canvas smaller than the frame then shows the
 * middle of the frame at one fixed scale, and a canvas bigger than the frame
 * still reaches no edge of the photo.
 */
export function coverShare(
  photoAspect: number,
  canvas: readonly [number, number],
  frame?: readonly [number, number],
): [number, number] {
  const [width, height] = canvas;
  const canvasCover = Math.max(width, height * photoAspect);
  const photoWidth = frame ? Math.max(canvasCover, frame[0], frame[1] * photoAspect) : canvasCover;
  const photoHeight = photoWidth / photoAspect;

  return [width / photoWidth, height / photoHeight];
}
