/**
 * The CSS size the poster was captured at in build-posters.sh, the widest
 * demo box, shared by the demo and the scene. The flutes are sized in CSS
 * pixels, so DemoPoster's pixel-locked mode shows the image at this size and
 * lets the box crop it. Cover-scaling would change the flutes' spacing, and
 * the grooves would jump when the live scene replaced the poster. The scene
 * fits the photo to this size for the same reason, so the photo keeps the
 * poster's scale in every box and doesn't zoom at the handoff.
 */
export const POSTER_SIZE: readonly [number, number] = [896, 598];
