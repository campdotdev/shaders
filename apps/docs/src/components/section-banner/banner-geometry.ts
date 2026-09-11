/**
 * The banner scene's fixed size in CSS pixels, shared by the scene, the box
 * it renders in, and the poster that stands in for it. The width is the
 * viewport width the Figma mock was drawn at, and the height is the header
 * block: the 56px nav row plus the 144px band, spacing-14 and spacing-36 in
 * the two CSS modules.
 *
 * Fixing the canvas at this size, centered, is what keeps the poster and the
 * live wall on one dot grid. The wall anchors its cells at its canvas's left
 * edge, so a canvas that spanned the viewport would put its grid a different
 * fraction of a cell from the poster's at every window width, and every dot
 * would jump at the handoff. Past 864px either side of center the glow has
 * already reached page black, so a wider viewport shows the page past the
 * box with no seam.
 */
export const BANNER_WIDTH = 1728;
export const BANNER_HEIGHT = 200;
