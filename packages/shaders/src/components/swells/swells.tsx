'use client';

// Public face of Swells: owns the props, their JSDoc, and their defaults,
// then delegates to SwellsShader (./shader.tsx), which draws a surface through
// a camera of its own by marching each pixel's ray over a height map. Swells
// draws only the surface and is transparent where the ray misses it, so the
// page shows through as the sky, or a sky Source mounted beneath it does.
import type { ColorSpace, HueInterpolation } from '../../engine.js';
import type {
  AnimatableProp,
  PositionProp,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { SwellsShader } from './shader.js';

export interface SwellsProps {
  /**
   * How high the camera sits above the ground, in terrain units. The
   * tallest crests reach `relief` units, so a camera below that can end up
   * inside a swell. Defaults to 1.5. Accepts a static value or an animation
   * signal.
   */
  altitude?: AnimatableProp<number>;
  /**
   * How far the camera looks down from the horizon, in degrees. 0 puts the
   * horizon across the middle of the canvas, and higher values lower the
   * camera's gaze, so the ground fills more of the frame and the sky less.
   * Defaults to 12. Accepts a static value or an animation signal.
   */
  tilt?: AnimatableProp<number>;
  /**
   * How much the camera sees from the bottom of the canvas to the top, in
   * degrees. Lower values zoom in and flatten the terrain's depth; higher
   * values widen the view and stretch near ground toward the viewer.
   * Defaults to 32. Accepts a static value or an animation signal.
   */
  fieldOfView?: AnimatableProp<number>;
  /**
   * How many swells, crest to crest, fit in 10 terrain units. Higher packs
   * in more, smaller swells; lower spreads out fewer, bigger ones. The
   * ripples keep their size. Defaults to 3, so a swell is about 3.3 units
   * long.
   * Accepts a static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How tall the swells are, in terrain units: the height of the tallest
   * crests. 0 flattens the swells into level ground, which still carries
   * ripples unless `ripples` is 0 too. Short swells, at a high `scale`, stop
   * growing taller once their steepest faces climb at about 72 degrees, so
   * the ray can't skip over their crests. Defaults to 0.9. Accepts a static
   * value or an animation signal.
   */
  relief?: AnimatableProp<number>;
  /**
   * The swells' shape, from 0 to 1. 0 gives round swells that ease over
   * their crests, like silk or open water, with both faces alike. 1 gives
   * sharp dune crests, with a long, gentle face and a short, steep one that
   * looks downwind. Defaults to 0.25. Accepts a static value or an animation
   * signal.
   */
  sharpness?: AnimatableProp<number>;
  /**
   * Which way the swells face, in compass degrees clockwise from the way
   * the camera faces at rest, the convention `lightAngle` uses. The crests
   * run square to it: at 0 they run straight across the canvas, and at 90
   * they run away from the camera toward the horizon. At full `sharpness`,
   * each swell's steep face looks this way, as a dune's looks downwind. The
   * camera always glides straight ahead, so at any angle but 0 and 180 it
   * crosses the crests at a slant. Defaults to 130. Accepts a static value
   * or an animation signal.
   */
  angle?: AnimatableProp<number>;
  /**
   * How strong the fine ripples on the surface are, from 0 to 1, where 0 is
   * a smooth surface and 1 is the deepest ripples. They show up close and fade
   * out with distance. Defaults to 0.6. Accepts a static value or an
   * animation signal.
   */
  ripples?: AnimatableProp<number>;
  /**
   * Where the light sits around the scene, in compass degrees clockwise from
   * the way the camera faces at rest: 0 straight ahead, so the camera looks
   * into the light and sees mostly shaded faces; 90 to the right; 180 behind
   * the camera, lighting the faces turned toward it; and 270 to the left.
   * The light stays put while a `parallax` sway turns the camera. Defaults to
   * 265, to the left and a little behind the camera. Accepts a static value
   * or an animation signal.
   */
  lightAngle?: AnimatableProp<number>;
  /**
   * How high the light sits, in degrees above the horizon, from 0 on the
   * horizon to 90 overhead. A low light rakes across the swells, so every
   * crest splits into a lit face and a shaded one; a high light falls on both
   * faces alike and flattens them. Defaults to 15. Accepts a static value or
   * an animation signal.
   */
  lightHeight?: AnimatableProp<number>;
  /**
   * The surface's color where it faces the light: hex, `oklch()`, or `oklab()`.
   * Faces turned from the light take `shadowColor`, and the slopes between
   * blend the two. Defaults to a bright purple, `'oklch(0.720 0.250 320)'`.
   */
  color?: string;
  /**
   * The surface's color on faces turned from the light: hex, `oklch()`, or
   * `oklab()`. Defaults to a deep blue, `'oklch(0.303 0.152 265.847)'`.
   */
  shadowColor?: string;
  /**
   * How strong the soft highlight is where the surface mirrors the light
   * toward the camera, from 0 to 1. 0 gives a matte surface, like dry sand;
   * higher values add a satin glow in `sheenColor` that slides over the
   * swells as the camera or the light moves. Defaults to 0.5. Accepts a static
   * value or an animation signal.
   */
  sheen?: AnimatableProp<number>;
  /**
   * The highlight's color: hex, `oklch()`, or `oklab()`. At full `sheen`,
   * the brightest point of the highlight is exactly this color. Defaults to
   * a pale pink, `'oklch(0.932 0.047 343.895)'`.
   */
  sheenColor?: string;
  /**
   * How thick the haze is, per terrain unit. With distance, the surface
   * first turns to `hazeColor`, then fades out into whatever is beneath
   * Swells, so the far field glows in the haze's color. 0 is clear air,
   * with the surface in its own colors until it fades out at the edge of
   * the camera's view. At `1 / haze` terrain units, about a third of the
   * surface's own color shows, and the near ground stays clear. Defaults to
   * 0.05. Accepts a static value or an animation signal.
   */
  haze?: AnimatableProp<number>;
  /**
   * The haze's color, which the far surface turns to before it fades out:
   * hex, `oklch()`, or `oklab()`. Defaults to a violet,
   * `'oklch(0.460 0.248 293.328)'`.
   */
  hazeColor?: string;
  /**
   * The color space the slopes between `shadowColor` and `color`, the
   * sheen over them, and the haze blend in. Defaults to `'oklab'`.
   */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
  /**
   * How fast the camera glides forward over the surface, in terrain units
   * per second. A swell is about 3.3 units long at the default `scale`, so
   * 0.3 passes one about every 11 seconds. Negative glides backward, and 0 holds
   * the camera still. A change of speed changes the pace without the
   * surface jumping, and the glide slows under reduced motion. Defaults to
   * 0.3. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * How fast the swells rise and fall in place, apart from the glide.
   * Every swell's height drifts on its own, so one crest grows while the
   * next settles, and at 1 the pattern of tall and short crests turns over
   * about once a second. 0 holds every swell at its height, as dunes are.
   * The crests never travel. The motion slows under reduced motion.
   * Defaults to 0.2. Accepts a static value or an animation signal.
   */
  swellSpeed?: AnimatableProp<number>;
  /**
   * How far the camera sways sideways toward `parallaxCenter`, in terrain
   * units, at the most. It keeps its height and turns a little to keep
   * facing the ground ahead, so near swells slide one way and far ones the
   * other, and the sway reads as depth. A center at the canvas's left or
   * right edge moves the camera the full amount, and one halfway to the edge
   * half as far. 0 keeps the camera fixed. The sway holds at 0 under reduced motion,
   * so a moving pointer never moves the view for a visitor who asked for
   * less motion. Defaults to 0. Accepts a static value or an animation
   * signal.
   */
  parallax?: AnimatableProp<number>;
  /**
   * The point the camera sways toward, 0..1 across the canvas with `[0, 0]`
   * at the top-left corner. Only its x moves the camera: the canvas's
   * middle means no sway, and a point right of it moves the camera right.
   * Pass `"cursor"` to follow the pointer, or a signal to drive the sway
   * from scroll or a timeline. Defaults to `[0.5, 0.5]`. Accepts a static
   * value or an animation signal.
   */
  parallaxCenter?: PositionProp;
  /**
   * Whether the surface builds itself in when the scene first draws: it
   * rises from flat ground in a sweep from the horizon toward the camera
   * while the haze clears, over about 3 seconds. It plays once per mount,
   * from the scene's first frame, or from the mount when Swells joins a scene
   * already drawing, and a prop change doesn't replay it. Under
   * reduced motion, and for posters, it skips to the finished surface.
   * `false` starts on the finished surface. Defaults to true.
   */
  intro?: boolean;
  /**
   * How dark the shadows are that crests cast across the surface behind
   * them, from 0 to 1. 0 casts none, so only a face's own tilt shades it;
   * at 1 a shadowed point gets no direct light. A low `lightHeight` casts long
   * shadows. Shadows cost GPU time on every lit pixel, and 0 costs none.
   * Defaults to 1. Accepts a static value or an animation signal.
   */
  shadows?: AnimatableProp<number>;
  /**
   * How much light the sky adds to faces the light doesn't reach, from 0 to
   * 1. At 0 those faces take `shadowColor` alone and read flat; higher
   * values lift them toward `color`, most where they face the light's side
   * of the sky, so the swells keep their shape in the shade. Defaults to
   * 0.5. Accepts a static value or an animation signal.
   */
  skylight?: AnimatableProp<number>;
  /**
   * How strongly surfaces seen edge-on glow in `sheenColor`, from 0 to 1:
   * the rims of crests and the far ground, which mirror the sky the way
   * water does at a low angle. 0 gives none. Defaults to 0.5. Accepts a
   * static value or an animation signal.
   */
  rimGlow?: AnimatableProp<number>;
  /**
   * How bright the grains of sand flash where they mirror the light at the
   * camera, from 0 to 1. The glints show in direct light, near the camera,
   * and twinkle as the camera glides. 0 gives none. Defaults to 0.8.
   * Accepts a static value or an animation signal.
   */
  glints?: AnimatableProp<number>;
  /**
   * How big the glints are: the width of one grain's cell, in terrain
   * units, from 0.002 to 0.2. Higher draws bigger glints, further apart,
   * that show from further away. Defaults to 0.02. Accepts a static value
   * or an animation signal.
   */
  glintSize?: AnimatableProp<number>;
}

// The colors are swatches from the brand palette: purple 9, blue 3,
// magenta 11, and violet 6 (SHA-339). ESLint's and Fallow's complexity
// rules count each default as a branch, and Swells has more defaulted props
// than their limits, with no logic of its own.
/* eslint-disable complexity */
// fallow-ignore-next-line complexity
export function Swells({
  altitude = 1.5,
  tilt = 12,
  fieldOfView = 32,
  scale = 3,
  relief = 0.9,
  sharpness = 0.25,
  angle = 130,
  ripples = 0.6,
  lightAngle = 265,
  lightHeight = 15,
  color = 'oklch(0.720 0.250 320)',
  shadowColor = 'oklch(0.303 0.152 265.847)',
  sheen = 0.5,
  sheenColor = 'oklch(0.932 0.047 343.895)',
  haze = 0.05,
  hazeColor = 'oklch(0.460 0.248 293.328)',
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
  speed = 0.3,
  swellSpeed = 0.2,
  parallax = 0,
  parallaxCenter = [0.5, 0.5],
  intro = true,
  shadows = 1,
  skylight = 0.5,
  rimGlow = 0.5,
  glints = 0.8,
  glintSize = 0.02,
}: SwellsProps) {
  return (
    <SwellsShader
      altitude={altitude}
      angle={angle}
      color={color}
      colorSpace={colorSpace}
      fieldOfView={fieldOfView}
      glintSize={glintSize}
      glints={glints}
      haze={haze}
      hazeColor={hazeColor}
      hueInterpolation={hueInterpolation}
      intro={intro}
      lightAngle={lightAngle}
      lightHeight={lightHeight}
      parallax={parallax}
      parallaxCenter={parallaxCenter}
      relief={relief}
      rimGlow={rimGlow}
      ripples={ripples}
      scale={scale}
      shadowColor={shadowColor}
      shadows={shadows}
      sharpness={sharpness}
      sheen={sheen}
      sheenColor={sheenColor}
      skylight={skylight}
      speed={speed}
      swellSpeed={swellSpeed}
      tilt={tilt}
    />
  );
}
/* eslint-enable complexity */
