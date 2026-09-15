/**
 * The banner scene's fixed size in CSS pixels, shared by the scene, the box
 * it renders in, and the poster that stands in for it. The width is the
 * viewport width the Figma mock was drawn at, and the height is the header
 * block: the 56px nav row plus the 144px band, spacing-14 and spacing-36 in
 * the two CSS modules.
 *
 * Fixing the canvas at this size, centered, is what keeps the poster and the
 * live scene on one grid of marks. DotField anchors its cells at its
 * canvas's center, so the grid's position comes from half the canvas size,
 * and a mark's arms are under a device pixel thick. A canvas that spanned
 * the viewport would put that half on a whole pixel at some window widths
 * and a half pixel at others, so the live grid would land a half pixel off
 * the poster's and the whole field would shift at the handoff. Both figures
 * here are even, so it never does. Past 864px either side of center the glow
 * has already reached page black, so a wider viewport shows the page past
 * the box with no seam.
 */
export const BANNER_WIDTH = 1728;
export const BANNER_HEIGHT = 200;
