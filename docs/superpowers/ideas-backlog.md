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

- **What:** animated noise overlay; intensity, scale, and color tint controls
- **Source:** Photoshop, Apple keynote treatments
- **Tier:** 1
- **Size:** S

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

### Drop pure TSL re-exports from `@lovo/matter` public API

- **What:** remove the pass-through re-exports of TSL primitives (`uv`, `vec2`, `vec3`, `vec4`, `time`, `mix`, `uniform`, `length`, `max`, `sin`, `cos`, `smoothstep`, `mod`, etc.) from `@lovo/matter`'s public surface. Keep only the _named-and-wrapped_ primitives (`fbm`, `noise`, `voronoi`, `colorRamp`, `sdfCircle`, `displace`, `cursorRipple`, `quantize`) and the runtime/React APIs.
- **Tier:** Infrastructure / API consolidation
- **Size:** S
- **Notes:** Reasoning: Matter sits _on top of_ TSL — it doesn't own those primitives. Re-exporting them muddies the layer boundary and provides no benefit (no rename, no added docs, no future-swap value). Honest layering would have users import `uv`/`vec3`/etc. directly from `three/tsl`. Migration: each Tier 1 component (`registry/*.tsx`) imports several of these from `@lovo/matter` today; ~6 files need a one-line import split per component. Existing end-user copies of components remain functional (re-exports can stay during a deprecation window or be removed in a major bump). Best planned alongside the `colorSpace` work as a "v0.2 API consolidation" milestone since both touch every Tier 1 component's imports.
