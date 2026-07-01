---
"@lovo/matter": major
---

Rework the `<Vignette>` component. Its props are renamed for clarity — `radius` is now `falloff` and `softness` is now `feather` — and the overlay blend gains `colorSpace` (default `oklab`) and `hueInterpolation` (default `shorter`), so the vignette can darken and tint in a chosen perceptual space rather than only in linear space. Defaults shift to `intensity` 0.3, `feather` 0.6, and a dark wide-gamut `oklch()` color.

This is a breaking change for anyone using `radius` or `softness`, or relying on the previous linear default blend.
