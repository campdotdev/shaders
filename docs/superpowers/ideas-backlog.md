# Ideas backlog

Parking lot for component ideas under consideration for Matter v2+. Not a roadmap; not a commitment. The point is to collect signal over time, then pattern-match: which categories have demand-pull, which primitives repeat across many ideas (Tier 2 candidates), which sit in awkward gaps worth skipping.

## How to use this file

When something catches your eye — a site, a Photoshop filter, a Shadertoy demo, a studio's portfolio piece — paste an entry below under the matching category. The lighter the friction the better; you can flesh out details later.

**Entry template:**

```
### <Working name>
- **What:** one-sentence description
- **Source:** where you saw it (URL, app, site, file)
- **Screenshot/clip:** path or link, optional but high-leverage later
- **Tier:** 1 (polished component) / 2 (TSL primitive) / 3 (recipe)
- **Size:** XS / S / M / L / XL guess
- **Notes:** anything else — composability, dependencies on other primitives, design caveats
```

After ~30-50 entries, sort and plan a milestone around the strongest cluster.

## Inspiration sources

Tier-ranked by signal per hour. When seeding the backlog below, browse from here.

### Tier 1 — systematic mining

- [The Book of Shaders](https://thebookofshaders.com/) — Patricio Gonzalez Vivo's canonical intro; each chapter is essentially a Tier 2 primitive ready to wrap
- [Inigo Quilez](https://iquilezles.org/) — SDFs, noise, distance functions, cosine palettes
- [Shadertoy](https://www.shadertoy.com/) — sort by [most popular all time](https://www.shadertoy.com/results?sort=popular&from=0&num=12) for global-consensus picks
- [LYGIA](https://github.com/patriciogonzalezvivo/lygia) — curated GLSL shader library, portable patterns
- **Photoshop / After Effects / DaVinci Resolve effect panels** — open the menus and treat each filter as a candidate; decades of validated demand

### Tier 2 — adjacent component libraries

- [Aceternity UI](https://ui.aceternity.com/) — closest competitor in the shadcn-style + shader-y backgrounds niche
- [Magic UI](https://magicui.design/)
- [21st.dev](https://21st.dev/)
- [Hover.dev](https://www.hover.dev/)
- [Shaders](https://shaders.com/)
- [Shaders Paper Design](https://shaders.paper.design/)

### Tier 2 — inspiration galleries

- [Mobbin](https://mobbin.com)
- [Awwwards](https://www.awwwards.com/) — esp. Site of the Day, Developer Awards (filter by WebGL)
- [Godly](https://godly.website/)
- [Httpster](https://httpster.net/)
- [SiteInspire](https://www.siteinspire.com/)
- [Refero](https://refero.design/)
- [One Page Love](https://onepagelove.com/)
- [Land-book](https://land-book.com/)
- [Lapa Ninja](https://www.lapa.ninja/)

### Tier 2 — production marketing sites worth dissecting

- [Linear](https://linear.app/)
- [Vercel](https://vercel.com/)
- [Stripe](https://stripe.com/)
- [Framer](https://www.framer.com/)
- [Family](https://family.co/)
- [Reflect](https://reflect.app/)
- [Raycast](https://www.raycast.com/)
- [Apple](https://www.apple.com/) — product pages, esp. AirPods/iPad

### Tier 3 — studios pushing the ceiling

(Search by name; portfolio domains shift, but these names are stable.)

- [Active Theory](https://activetheory.net/)
- [Resn](https://resn.co.nz/)
- [Lusion](https://lusion.co/)
- [Locomotive](https://locomotive.ca/)
- [Hello Monday](https://www.hellomonday.com/)
- **Immersive Garden** — search
- **Antinomy** — search

### Bonus — color & palette references

- [Coolors](https://coolors.co/) — palette generator
- [Lospec palette list](https://lospec.com/palettes) — retro palettes; pairs naturally with Dither, Pixelate, Posterize
- [Inigo Quilez's palette page](https://iquilezles.org/articles/palettes/) — generative cosine palettes (canonical reference for the `palette()` Tier 2 primitive)

---

## Already shipped (v1) — don't re-add

Aurora, DotField, LinearGradient, MeshGradient, NoiseField, Waves.

---

## Backgrounds (generative fills)

### Voronoi mosaic

- **What:** animated cell pattern with controllable density, jitter, and edge softness
- **Source:** Shadertoy classics, Book of Shaders ch. 12
- **Tier:** 1 (component) backed by Tier 2 `voronoi()` primitive
- **Size:** M

### Plasma

- **What:** demoscene-era chromatic noise field, deeply customizable palette
- **Source:** Demoscene (pouet.net), Book of Shaders
- **Tier:** 1
- **Size:** S

### Marble veins

- **What:** flowing FBM-driven marble texture, two-color base + vein highlights
- **Source:** Shaders.com, Book of Shaders ch. on FBM
- **Tier:** 1
- **Size:** M

### Conic gradient

- **What:** angular sweep gradient with N color stops (CSS conic-gradient on the GPU)
- **Source:** CSS, Figma fills
- **Tier:** 1
- **Size:** S

### Radial gradient

- **What:** circular falloff gradient, controllable center/radius/falloff curve
- **Source:** CSS, Figma fills
- **Tier:** 1
- **Size:** XS

### Lava Lamp

- **What:** Floatings and sinking blobs like a lava lamp, pieces pulling apart from each other
- **Source:**
- **Tier:** 1
- **Size:** M

### God Rays

- **What:** Sunbeams spilling down through the clouds in big, dramatic shafts of light
- **Source:**
- **Tier:** 1
- **Size:** M

### Stars Nebula

- **What:** Stars and colorful space nebula in space
- **Source:**
- **Tier:** 1
- **Size:** L

## Hologram

- **What:** Shiny holo effect that you would often see with trading cards, slight rainbow sheen
- **Source:**
- **Tier:** 1
- **Size:** S

---

## Surfaces (overlays meant to layer)

### Film grain

- **What:** standalone `<FilmGrain>` overlay component that can be stacked
  in a `<MatterScene>` to apply grain to any underlying effect. Intensity,
  shutter rate, scale, color tint, blend mode controls.
- **Source:** Photoshop, Apple keynote treatments,
  [shaders.com Design Editor](https://shaders.com) (Saturation / Swirl
  stacked-effects model).
- **Tier:** 1 (Surfaces category — first member of the overlay category).
- **Size:** M (component is small; the *architecture* it forces is the work).
- **Notes:**
  - **Primitive already shipped.** `filmGrain(uvNode, intensity, timeOffset?)`
    landed in `@lovo/matter` in MAT-8 phase 6b. The `<FilmGrain>` component
    becomes a thin wrapper around the primitive plus the overlay/blend
    plumbing — no hash math to redesign.
  - **Architecture decision required before building.** Two paths, both
    real product work:
    1. *Transparent overlay mesh.* `<FilmGrain>` creates its own
       full-screen plane with `material.transparent = true` and an additive
       blend equation so centered grain (mean = 0) adds zero net brightness
       to the destination. Lighter; fits the current `MatterScene` (single
       `renderer.render(scene, camera)` call).
    2. *Render-pass / post-processing pipeline.* `MatterScene` grows a
       compositor; each overlay component contributes a fullscreen pass that
       runs after the base scene. Heavier; matches `EffectComposer` and
       sets up `<Vignette>`, `<Bloom>`, `<ChromaticAberration>` cleanly for
       the rest of the v2 overlay catalog.
  - **Stacking order: later child in JSX = renders on top.** Matches CSS,
    Figma, Photoshop. shaders.com inverts this (below-in-list applies to
    above), which their own users find unintuitive — avoid replicating.
    For the overlay-mesh path use `renderOrder`; for the pass path,
    process passes in JSX-declaration order.
  - **Subtractive variant.** MAT-8 shipped centered grain as the default
    because subtractive crushes blacks and surprises users. Expose a
    `mode: 'centered' | 'subtractive'` prop on `<FilmGrain>` for users
    who specifically want the film-stock darkening look.
  - **Twinkle rate.** The primitive deliberately doesn't bake in a shutter
    rate — caller passes a time node. `<FilmGrain>` should expose a
    `speed` prop (0 = static, 1 = ~60Hz default matching MAT-8, lower for
    film-cadence ~24Hz) and quantize internally via `floor(time*speed*60)`.
  - **Trigger to start work:** beginning v2 overlay-component planning
    (first milestone after v1 publish) or any user request for "grain on
    a non-MeshGradient component."

### Halftone

- **What:** dot-pattern stylization, configurable angle, dot size, threshold
- **Source:** Photoshop, retro print
- **Tier:** 1
- **Size:** M

### Dither

- **What:** low-color quantization with Bayer or Floyd-Steinberg dithering
- **Source:** Retro games, Lospec palettes
- **Tier:** 1
- **Size:** M

### Paper texture

- **What:** organic noise meant to evoke paper grain or canvas
- **Source:** Photoshop filter gallery
- **Tier:** 1
- **Size:** S

---

## Motion fields (input-driven)

### Cursor ripples

- **What:** wave propagation outward from cursor position; controllable amplitude, decay, color
- **Source:** Active Theory, Resn portfolio interactives
- **Tier:** 1 component + Tier 2 `cursorField()` primitive
- **Size:** M

### Cursor trail

- **What:** particle-style trail behind cursor; configurable particle count, lifetime, color
- **Source:** same as above
- **Tier:** 1
- **Size:** M

### Scroll parallax field

- **What:** layered depth that responds to scroll position; built-in scroll signal binding
- **Source:** Apple product pages
- **Tier:** 1 + Tier 2 `scrollField()`
- **Size:** M

### Liquify on hover

- **What:** geometric UV warp localized around cursor, like Photoshop liquify
- **Source:** Photoshop, AR filter galleries (Spark AR Hub)
- **Tier:** 1
- **Size:** L

---

## Effects (post-process on content beneath)

### Glow / bloom

- **What:** soft halo around bright pixels; threshold + radius + intensity controls
- **Source:** Unreal post-process volume, AE
- **Tier:** 1
- **Size:** M

### Chromatic aberration

- **What:** RGB channel separation; intensity + direction (radial or directional)
- **Source:** VJ tools, AE
- **Tier:** 1
- **Size:** S

### Vignette

- **What:** darkened or colored edges; customizable shape and softness
- **Source:** AE, Photoshop
- **Tier:** 1
- **Size:** XS

### Lens flare

- **What:** light-source-driven flare with anamorphic options
- **Source:** AE Optical Flares
- **Tier:** 1
- **Size:** L

---

## Distortions

### Wave distortion

- **What:** sine-wave UV displacement; axis, frequency, amplitude, phase
- **Source:** AE Wave Warp
- **Tier:** 1
- **Size:** S

### Kaleidoscope

- **What:** radial mirror with N segments; configurable origin and rotation
- **Source:** Shaders.com, AE
- **Tier:** 1
- **Size:** M

### Spherize / bulge

- **What:** radial UV warp from a point; positive (bulge) or negative (pinch)
- **Source:** Photoshop spherize
- **Tier:** 1
- **Size:** S

---

## Blurs

### Progressive blur

- **What:** blur strength gradients across an axis (the iOS frosted-glass-at-list-bottom effect)
- **Source:** iOS, Reflect.app, Arc/Dia browser
- **Tier:** 1
- **Size:** M

### Zoom blur

- **What:** radial motion blur from a focal point
- **Source:** AE Radial Blur
- **Tier:** 1
- **Size:** S

### Tilt-shift

- **What:** focused band of sharpness with blur outside the band
- **Source:** Photography, Instagram early days
- **Tier:** 1
- **Size:** M

---

## Adjustments

### Duotone

- **What:** two-color mapping based on luminance
- **Source:** Spotify cover art, Photoshop duotone
- **Tier:** 1
- **Size:** S

### Hue shift

- **What:** angle-based color rotation
- **Source:** Photoshop, AE
- **Tier:** 1
- **Size:** XS

### Posterize

- **What:** quantize color into N steps
- **Source:** Photoshop
- **Tier:** 1
- **Size:** XS

---

## Retro stylize

### CRT screen

- **What:** scanlines, RGB phosphor pattern, slight curvature, mild chromatic separation
- **Source:** Old TVs, VHS Filter app, demoscene
- **Tier:** 1
- **Size:** L

### VHS

- **What:** color bleed, tracking lines, jitter, noise
- **Source:** Retro footage references
- **Tier:** 1
- **Size:** M

### ASCII

- **What:** luminance-to-glyph mapping over the source content
- **Source:** ASCII art tools, demoscene
- **Tier:** 1
- **Size:** M

### Glitch

- **What:** RGB shift + slice displacement + flicker; deterministic or random
- **Source:** Aceternity UI, Active Theory work
- **Tier:** 1
- **Size:** M

### Pixelate

- **What:** block mosaic; configurable block size, optional palette quantization
- **Source:** Photoshop
- **Tier:** 1
- **Size:** XS

---

## Tier 2 primitives that fall out

These show up repeatedly across the entries above; promoting them as Tier 2 primitives multiplies their value and lets users compose new effects.

- `fbm(uv, octaves, persistence, lacunarity)` — already exists; widely reused
- `voronoi(uv, density, jitter)` — backs voronoi mosaic, liquify, plasma
- `cursorField(cursor, falloff)` — backs ripples, trail, liquify-on-hover, scroll-with-cursor combos
- `scrollField(scroll, ...)` — first-class scroll signal, used in parallax + scroll-reactive variants
- `radialMask(uv, center, radius, softness)` — used by vignette, spherize, zoom blur, lens flare
- `palette(t, a, b, c, d)` — Inigo Quilez cosine palettes; backs every gradient-heavy effect

---

## Cross-component infrastructure

These aren't Tier 1 components themselves; they're cross-cutting concerns that affect how every Tier 1 component handles a shared concept. Designed once, applied to all components.

### `colorSpace` prop across all Tier 1 components

- **What:** prop accepting `'srgb' | 'linear' | 'oklab' | 'oklch' | 'hsl' | 'hsv' | 'lch'` that controls the space colors are interpolated/blended in. Affects how multi-color props (gradient stops, mesh-gradient corners, aurora curtains) are mixed at runtime — OKLab/OKLCH give perceptually uniform transitions, sRGB matches user expectation but blends muddy through neutrals.
- **Source:** [Paper Design Shaders](https://shaders.paper.design/) (`colorSpace` prop on every component), CSS Color Module Level 4, [Björn Ottosson on OKLab](https://bottosson.github.io/posts/oklab/).
- **Tier:** Infrastructure
- **Size:** M
- **Notes:** Two layers. (1) JS-side parsing — pulls hex/rgb/hsl/oklch/named strings into canonical sRGB; recommend [culori](https://culorijs.org/) (~14KB, every space supported). (2) GPU-side blending — when `colorSpace` isn't sRGB, convert in JS once before sending as uniform, blend in that space on the GPU with `mix()`, convert back to sRGB at output. OKLab requires 3×3 matrix + cube-root math; HSL requires angular hue mixing. Current registry components all ship a local `hexToVec3` that does no conversion — replace those when this lands. Tracked in Linear (issue already created).

### ~~Stable `Vector3` in `useColorUniform`~~ — shipped in MAT-16 phase 4

Fixed alongside the same pattern in Vignette. The `useMemo` for the underlying
`Vector*` instance now has empty deps in `useColorUniform` (Aurora +
MeshGradient), `colorVec`/`dirVec` in `AuroraShader`, and `centerVec`/`colorVec`
in `VignetteShader`. Prop changes flow through the existing `.set()` effects;
uniform node identity is stable; material no longer recompiles on color-picker
or direction drags.

### Promote `useColorUniform` to `@lovo/matter-react`

- **What:** Lift the inline `useColorUniform` helper out of each registry
  component (Aurora, MeshGradient, future shaders) and into
  `@lovo/matter-react` as a public hook. Replaces N inline copies with one
  canonical implementation; users on Mode 2 (custom r3f integration) gain
  access to the same hook for their own reactive color uniforms.
- **Source:** Repeated pattern across registry components; design tension
  with the copy-paste "everything's in your codebase" registry model.
- **Tier:** Infrastructure
- **Size:** S
- **Notes:** Lift only when ALL of these are true:
  1. The `Vector3` stability fix above is in (so we lift a stable internal
     shape, not the current `[hex]`-dep quirk).
  2. The `colorSpace` cross-component infrastructure is being designed (so
     the public signature — likely `useColorUniform({ value, colorSpace })`
     or similar — can be built once for the long run, not lifted twice).
  3. At least three Tier 1 components use the inline pattern (Aurora today,
     MeshGradient incoming as #2; need one more before "rule of three"
     extraction is justified).
  Breaking change: registry components stop carrying their own
  `useColorUniform` and import from `@lovo/matter-react`. Users who already
  copy-pasted an older registry component keep the inline version until
  they refresh via the CLI, so no immediate break. Minor bump on
  `@lovo/matter-react` for the new public hook export.

### ~~Drop pure TSL re-exports from `@lovo/matter` public API~~ — shipped in 0.2.0 (M9)

Shipped 2026-05-25 — see `docs/superpowers/plans/2026-05-25-matter-m9-drop-tsl-reexports.md` and the 0.2.0 changelog.
