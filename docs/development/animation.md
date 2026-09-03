# Animation principles and motion tokens for the docs site

Research notes behind a motion token set for `apps/docs/src/app/tokens.css`. The site has one animation today: the props-table chevron and panel in `apps/docs/src/components/props-table/props-table.module.css`, both on `150ms ease-out`. Every number and rule below carries the URL that owns it. Where a source is paywalled or unreadable, the note says so instead of guessing. Fetched 2026-09-01.

## The principles that matter most

**Use `ease-out` by default, and never `ease-in` for UI.** Emil Kowalski: "The best type of easing for this purpose is `ease-out`. It starts fast and slows down at the end, which gives the impression of a quick response, while maintaining a smooth transition." ([Great animations](https://emilkowal.ski/ui/great-animations)). His free lesson adds: "you should avoid `ease-in` as it makes the UI feel slow" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). Material pairs a decelerating curve with elements that enter and an accelerating curve with elements that exit, which is the same idea in token form ([Material Android motion guide](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).

**Keep it under 300ms.** "Your animations should also usually be shorter than 300ms" ([Great animations](https://emilkowal.ski/ui/great-animations)) and "UI animations should generally stay under `300ms`" ([7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)). Apple says the same without a number: "Aim for brevity and precision in feedback animations" and "In apps, generally avoid adding motion to UI interactions that occur frequently" ([Apple HIG, Motion](https://developer.apple.com/design/human-interface-guidelines/motion)).

**Animate `transform` and `opacity`. Treat everything else as a cost.** "you should try to animate with `transform` and `opacity` as they only trigger the third rendering step (composite), while padding or margin triggers all three (layout, paint, composite)" ([Great animations](https://emilkowal.ski/ui/great-animations)). Google's guidance is the source of that claim: "Where possible, restrict animations to `opacity` and `transform` to keep animations on the compositing stage of the rendering path" ([web.dev, Animations guide](https://web.dev/articles/animations-guide)). Chrome's compositor also runs `filter` off the main thread ([Chrome, Hardware-accelerated animations](https://developer.chrome.com/blog/hardware-accelerated-animations)).

**Prefer transitions to keyframes, because a transition can be interrupted.** "A CSS transition can be interrupted and smoothly transition to a new value, even before the first transition has finished" ([Great animations](https://emilkowal.ski/ui/great-animations)). Base UI agrees: "Transitions are recommended over CSS animations, because a transition can be smoothly cancelled midway" ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)).

**Honor `prefers-reduced-motion`, and replace movement with fades rather than deleting feedback.** Apple's list of what to do when Reduce Motion is on includes "Replacing transitions in x-, y-, and z-axes with fades to avoid motion" and "Tightening animation springs to reduce bounce effects" ([Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). MDN's example swaps a scaling animation for a dissolve because "Animations such as scaling or panning large objects can be vestibular motion triggers" ([MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)). Google states the target: "interfaces should minimize movement or animation, preferably to the point where all non-essential movement is removed" ([web.dev, prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)). Sonner takes the blunt route and sets `transition: none !important; animation: none !important;` under `@media (prefers-reduced-motion)` ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)).

**Custom curves beat the built-in keywords for anything bigger than a hover.** "the accelerations of the built-in ones are not strong enough" and "The only time I personally use a built-in easing curve is for hover effects when I reach for the `ease` curve" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). His set of 16 custom curves sits behind the paywall at `animations.dev/learn/easing-curves`. That page serves an empty JavaScript shell to a plain fetch, so none of those curves can be cited here.

## Concrete numbers

### Durations

| Range | Where it applies | Source |
| --- | --- | --- |
| 100ms | Icon rotation on a Base UI trigger, close-button opacity in Sonner. | Base UI's accordion demo: `.Icon { transition: transform 100ms ease-out; }` ([Base UI, Accordion](https://base-ui.com/react/components/accordion)). Sonner: `transition: opacity 100ms, background 200ms, border-color 200ms;` on the close button ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)). |
| 150ms | Panels, popups, button presses. | Base UI's accordion panel: `transition: height 150ms ease-out;` and its popup example: `transition: transform 150ms, opacity 150ms;` ([Base UI, Accordion](https://base-ui.com/react/components/accordion), [Animation handbook](https://base-ui.com/react/handbook/animation)). Emil: "A scale of 0.97 on the :active pseudo-class with a 150ms transition should do the job" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). |
| 200ms | Exits and swipe-outs. | Sonner's swipe-out keyframes: `animation-duration: 200ms; animation-timing-function: ease-out;` and `sonner-fade-out 0.2s ease forwards` ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)). |
| 250ms | Base UI's keyframe example for open and close. | `.Popup[data-open] { animation: scaleIn 250ms ease-out; } .Popup[data-closed] { animation: scaleOut 250ms ease-in; }` ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)). |
| 300ms | The ceiling for UI animation. | "shorter than 300ms" ([Great animations](https://emilkowal.ski/ui/great-animations)); "stay under `300ms`" ([7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)). |
| 400ms to 500ms | Large surfaces that enter the screen: toasts and drawers. Deliberately slower than the ceiling. | Sonner's toast: `transition: transform 400ms, opacity 400ms, height 400ms, box-shadow 200ms;`, which Emil describes as "a bit slower than usual" to "feel more elegant" ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css), [Great animations](https://emilkowal.ski/ui/great-animations)). Vaul's drawer: `TRANSITIONS = { DURATION: 0.5, EASE: [0.32, 0.72, 0, 1] }`, because "Duration of 500ms is also supposed to mimic iOS's Sheet" ([Vaul constants.ts](https://raw.githubusercontent.com/emilkowalski/vaul/main/src/constants.ts), [Building a drawer component](https://emilkowal.ski/ui/building-a-drawer-component)). |

Material's scale for comparison: `duration-short1` 50ms through `duration-short4` 200ms, `medium1` 250ms through `medium4` 400ms, `long1` 450ms through `long4` 600ms, and `extra-long1` 700ms through `extra-long4` 1000ms ([Material Web tokens, md-sys-motion](https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss)). Its rule for choosing among them: "duration should increase as the area/traversal of an animation increases" ([Material Android motion guide](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).

### Enter versus exit

None of Emil's public writing states an enter-versus-exit duration rule. His code does. Sonner's toast enters over 400ms and swipes out over 200ms ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)). Vaul uses the same 0.5s and curve in both directions ([Vaul style.css](https://raw.githubusercontent.com/emilkowalski/vaul/main/src/style.css)). Base UI's examples use one duration both ways and change only the curve, `ease-out` in and `ease-in` out ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)). Material's tokens encode the curve split directly: "Standard Decelerate" is for "utility focused animations that enter the screen" and "Standard Accelerate" for "utility focused animations that exit the screen" ([Material Android motion guide](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)). The working rule that fits all four sources: same or shorter on the way out, and an out curve that starts faster than the in curve.

### Easing curves

The built-in keywords, as the spec defines them ([CSS Easing Functions Level 2](https://www.w3.org/TR/css-easing-2/)):

| Keyword | Equivalent | Emil's use for it |
| --- | --- | --- |
| `ease-out` | `cubic-bezier(0, 0, 0.58, 1)` | "I apply this easing for most elements that have an enter and exit animation" and "user-initiated interactions like opening a dropdown or a modal" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). |
| `ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | "elements that are already on the screen and need to move to a new position, or morph into a new shape" (same lesson). |
| `ease` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | "mostly for hover effects that transition color, background-color, opacity" (same lesson). Also the default `transition-timing-function`, so a `transition: x 150ms` with no curve uses it ([MDN, transition](https://developer.mozilla.org/en-US/docs/Web/CSS/transition)). |
| `linear` | identity, `linear(0, 1)` | "only for constant animations like a marquee" or "interactive elements where you need to visualize the passage of time" (same lesson). |
| `ease-in` | `cubic-bezier(0.42, 0, 1, 1)` | Avoid. "it makes the UI feel slow" (same lesson). |

Custom curves with a public source:

| Curve | Character | Source |
| --- | --- | --- |
| `cubic-bezier(0.32, 0.72, 0, 1)` | A strong ease-out. "The curve used in Vaul closely matches the one used in iOS; it's from the Ionic Framework." | [Building a drawer component](https://emilkowal.ski/ui/building-a-drawer-component), [Vaul constants.ts](https://raw.githubusercontent.com/emilkowalski/vaul/main/src/constants.ts) |
| `cubic-bezier(0.59, 0.02, 0.39, 1)` | A custom ease-in-out. The free lesson's timeline demo runs it at `--duration:600ms` as its example of on-screen movement. The lesson does not name it, so read it as one of his curves in use, not as a published recommendation. | [The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint) (page markup) |
| `cubic-bezier(0.05, 0.7, 0.1, 1)` | Material `easing-emphasized-decelerate`, for entering. | [Material Web tokens](https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss) |
| `cubic-bezier(0.3, 0, 0.8, 0.15)` | Material `easing-emphasized-accelerate`, for exiting. | same |
| `cubic-bezier(0.2, 0, 0, 1)` | Material `easing-emphasized` and `easing-standard`, for movement that begins and ends on screen. | same |
| `cubic-bezier(0, 0, 0, 1)` | Material `easing-standard-decelerate`. | same |
| `cubic-bezier(0.4, 0, 0.2, 1)` | Material `easing-legacy`, the Material 2 standard curve. | same |

`linear()` is the spec's route to spring and bounce shapes that a cubic bezier cannot draw. It takes a list of stops with optional percentages: "`linear(0, 0.25 75%, 1)` produces the following easing function, which spends 75% of the time transitioning from 0 to .25, then the last 25% transitioning from .25 to 1" ([CSS Easing Functions Level 2](https://www.w3.org/TR/css-easing-2/)). Stop values "outside the `0` to `1` range are also allowed", which is what lets a curve overshoot ([MDN, linear()](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear)). It is Baseline Widely available, "available across browsers since December 2023" (same page). Emil's public posts and free lesson do not publish a `linear()` spring, so this doc proposes none. Emil recommends springs in general: "I highly suggest playing around with spring animations in your projects" ([Great animations](https://emilkowal.ski/ui/great-animations)).

### Which properties, and the height problem

Google names exactly two compositor-only properties: "Today there are only two properties for which that is true - `transform`s and `opacity`" ([web.dev, Stick to compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)). Chrome's compositor additionally accelerates `filter`, with `background-color` and `clip-path` noted as coming ([Chrome, Hardware-accelerated animations](https://developer.chrome.com/blog/hardware-accelerated-animations)). Animating size triggers layout: "animating the `width` and `height` of an element changes its geometry and may cause other elements on the page to move or change size. This process is called _layout_" ([web.dev, Animations and performance](https://web.dev/articles/animations-and-performance)). Google's advice on `will-change` is to hold off: "use it only if you notice graphics issues and think that promoting an element to a new layer might help" ([web.dev, Animations guide](https://web.dev/articles/animations-guide)) and "Do not promote elements unnecessarily" ([web.dev, Stick to compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).

The accordion panel animates `height`, so it pays for layout on every frame. That is the trade the Base UI pattern makes, and it is acceptable at 150ms on a panel that holds a few rows of text. Two things keep it cheap. The panel already sets `overflow: hidden`, and Base UI supplies a pixel value in `--accordion-panel-height`, so the transition runs between two lengths and needs no `interpolate-size`. Chrome's `interpolate-size: allow-keywords` and `calc-size()` exist for the `height: auto` case, but as of the Chrome article they ship in "Chrome: 129+" and "Edge: 129+" with "Firefox: Not supported" and "Safari: Not supported" ([Chrome, Animate to height: auto](https://developer.chrome.com/docs/css-ui/animate-to-height-auto)). Don't reach for them here.

## Proposed tokens for `tokens.css`

Naming follows the file's existing shapes: t-shirt sizes as in `--radius-xl` and `--font-size-sm`, and plain nouns as in `--font-mono`. Two families, one for duration and one for easing, plus a reduced-motion override.

```css
/* ---- Motion ----
   Durations in ms. UI animation stays under 300ms; the two larger steps
   exist for surfaces that enter the screen, such as a toast or drawer. */
--duration-xs: 100ms; /* icon rotation */
--duration-sm: 150ms; /* panels, popups, button press */
--duration-md: 250ms; /* larger reveals, still under the 300ms ceiling */
--duration-lg: 400ms; /* toasts and drawers only */

/* The same steps again for opacity and color. Reduce Motion zeroes the
   --duration-* family and leaves this one alone. */
--fade-xs: 100ms; /* hover color and opacity */
--fade-sm: 150ms; /* the opacity half of a popup or panel */
--fade-md: 250ms;
--fade-lg: 400ms;

/* Easings. ease-out for anything entering or exiting, ease-in-out for
   things that move while on screen, ease for hover color changes,
   linear for constant motion. Never ease-in for UI. */
--ease-out: cubic-bezier(0.32, 0.72, 0, 1);
--ease-in-out: cubic-bezier(0.59, 0.02, 0.39, 1);
--ease-hover: ease;
--ease-linear: linear;
```

Where each value comes from:

| Token | Value | Source |
| --- | --- | --- |
| `--duration-xs` | 100ms | Base UI's icon transition `transform 100ms ease-out` ([Base UI, Accordion](https://base-ui.com/react/components/accordion)). Sonner's close button opacity `100ms` ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)). Material `duration-short2` ([Material Web tokens](https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss)). |
| `--duration-sm` | 150ms | Base UI's panel `height 150ms ease-out` and popup `150ms` ([Base UI, Accordion](https://base-ui.com/react/components/accordion), [Animation handbook](https://base-ui.com/react/handbook/animation)). Emil's `150ms` button press ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). Material `duration-short3`. |
| `--duration-md` | 250ms | Base UI's keyframe example `250ms` ([Animation handbook](https://base-ui.com/react/handbook/animation)). Material `duration-medium1`. Sits under Emil's 300ms ceiling ([Great animations](https://emilkowal.ski/ui/great-animations)). |
| `--duration-lg` | 400ms | Sonner's toast enter `400ms` ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)). Material `duration-medium4`. |
| `--ease-out` | `cubic-bezier(0.32, 0.72, 0, 1)` | Vaul's curve, "closely matches the one used in iOS" ([Building a drawer component](https://emilkowal.ski/ui/building-a-drawer-component), [Vaul constants.ts](https://raw.githubusercontent.com/emilkowalski/vaul/main/src/constants.ts)). Chosen over the keyword because "the accelerations of the built-in ones are not strong enough" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). Material's `easing-emphasized-decelerate`, `cubic-bezier(0.05, 0.7, 0.1, 1)`, is the alternative if the site wants a more pronounced settle. |
| `--ease-in-out` | `cubic-bezier(0.59, 0.02, 0.39, 1)` | The curve the free lesson's on-screen movement demo runs ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint), page markup). Material's `easing-standard`, `cubic-bezier(0.2, 0, 0, 1)`, is the alternative with a published name. |
| `--ease-hover` | `ease` | "I use this one mostly for hover effects that transition color, background-color, opacity" ([The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint)). Spec value `cubic-bezier(0.25, 0.1, 0.25, 1)` ([CSS Easing Functions Level 2](https://www.w3.org/TR/css-easing-2/)). |
| `--ease-linear` | `linear` | "only for constant animations like a marquee" (same lesson). |

There is no `--ease-in` token. Material's `easing-emphasized-accelerate`, `cubic-bezier(0.3, 0, 0.8, 0.15)`, is the candidate if the site ever needs an exit that clears fast, but the site has no such exit, the rule at the top of this doc says never to use `ease-in` for UI, and AGENTS.md rules out inert entries added for symmetry.

### Reduced-motion strategy

Put the override next to the tokens, so every consumer inherits it and no component needs its own media query:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-xs: 0ms;
    --duration-sm: 0ms;
    --duration-md: 0ms;
    --duration-lg: 0ms;
  }
}
```

This follows Google's "all non-essential movement is removed" ([web.dev, prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)) for the movement, while stopping short of Sonner's wholesale `transition: none` ([Sonner styles.css](https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css)), which would also delete the fades. Zeroing the duration through the token rather than writing `transition: none` keeps each component's declaration intact, so a state change still applies instantly and nothing has to be written twice.

Two refinements the sources support. First, Apple asks for fades in place of movement ("Replacing transitions in x-, y-, and z-axes with fades to avoid motion", [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)), and Emil's course puts it as "gentler, not zero": keep the opacity or color change that carries meaning, drop the travel. That is why the fades have their own `--fade-*` family with the same steps. The override zeroes `--duration-*`, which drives `transform` and `height`, and leaves `--fade-*` alone, so a popup that scales in becomes a popup that fades in and a hover color still eases. The split is by property, not by size: a fade written on a `--duration-*` token disappears under Reduce Motion, which is the bug to look for in review. Second, MDN's guidance is that `reduce` is "equivalent to `@media (prefers-reduced-motion)`" and that the setting maps to the OS switches it lists, macOS "System Settings > Accessibility > Display > Reduce motion" among them ([MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)). Test with that switch, not with DevTools alone.

One thing to verify before shipping the override: Base UI detects the end of an exit through `element.getAnimations()` ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)). A 0ms transition starts no animation, so the panel should unmount at once. That is the intended result, but the handbook does not state it, so check the props table with Reduce Motion on.

## Base UI enter and exit patterns

Base UI has two patterns, and the difference is which attributes it sets. For transitions, "`[data-starting-style]` corresponds to the initial style to transition from" and "`[data-ending-style]` corresponds to the final style to transition to". For keyframe animations, "`[data-open]` corresponds to the style applied when a component becomes visible" and "`[data-closed]` corresponds to the style applied before a component becomes hidden" ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)). The accordion panel exposes `--accordion-panel-height` and `--accordion-panel-width`, with `data-starting-style` "Present when the panel begins animating in" and `data-ending-style` "Present when the panel is animating out" ([Base UI, Accordion](https://base-ui.com/react/components/accordion)). The trigger carries `data-panel-open`, which is what the chevron keys off.

Because Base UI holds the starting attribute for the first frame itself, the docs site does not need `@starting-style` for Base UI components. That at-rule exists for the case Base UI is solving on its own: "CSS transitions are by default not triggered on an element's initial style update, or when its `display` type changes from `none` to another value. To enable first-style transitions, `@starting-style` rules are needed" ([MDN, @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)). Reach for it, together with `transition-behavior: allow-discrete`, only for a plain element the site toggles through `display: none` without Base UI. With `allow-discrete`, "When animating `display` from `block` (or another visible `display` value) to `none`, the value will flip to `none` at `100%` of the animation duration so it is visible throughout" ([MDN, transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior)). Both are Baseline 2024, "Since August 2024" (same pages).

The existing props-table CSS is rewritten on the tokens. Two things change. Both transitions take the custom curve in place of the `ease-out` keyword, and the chevron drops from 150ms to `--duration-xs`, the 100ms Base UI's own demo uses for its icon. The panel keeps its 150ms as `--duration-sm`:

```css
.chevron {
	color: var(--gray-200);
	transition: transform var(--duration-xs) var(--ease-out);
}

.trigger[data-panel-open] .chevron {
	transform: rotate(180deg);
}

.panel {
	height: var(--accordion-panel-height);
	overflow: hidden;
	transition: height var(--duration-sm) var(--ease-out);
}

.panel[data-starting-style],
.panel[data-ending-style] {
	height: 0;
}
```

For a popup or tooltip, the same two attributes carry a compositor-only fade and scale. Base UI's own example is `transition: transform 150ms, opacity 150ms;` with `opacity: 0; transform: scale(0.9);` under both attributes ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)). Two of Emil's tips adjust it: start no smaller than `0.93` ("Don't animate from scale(0)") and set the origin to the trigger ("Make your animations origin-aware") ([7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)). Base UI supplies that origin as `--transform-origin` on its positioned popups ([Base UI, Animation handbook](https://base-ui.com/react/handbook/animation)):

```css
.popup {
	transform-origin: var(--transform-origin);
	transition:
		transform var(--duration-sm) var(--ease-out),
		opacity var(--fade-sm) var(--ease-out);
}

.popup[data-starting-style],
.popup[data-ending-style] {
	opacity: 0;
	transform: scale(0.95);
}
```

## What could not be verified

The animations.dev course is paid. Its landing page lists modules and promises "how to choose the right easing and timing" but publishes no numbers ([animations.dev](https://animations.dev/)). The one lesson that loads without an account is The Easing Blueprint, cited above. The custom-curve list it links, `animations.dev/learn/easing-curves`, returns a 16KB JavaScript shell with no readable text, so the 16 named curves are not in this document. The lesson's own page chrome uses `cubic-bezier(.25,.46,.45,.94)` at `250ms` for its video controls, which is the site's styling and not a stated recommendation, so it is not proposed as a token. Material's `m3.material.io` pages render client-side and returned only a title, so the token values come from Material's own source repository and the enter-versus-exit pairing from Material's Android documentation. Apple's HIG pages behave the same way, so the quotes come from the JSON that renders them, at `developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json` and `accessibility.json`.

## Sources

- https://emilkowal.ski/ui/great-animations
- https://emilkowal.ski/ui/good-vs-great-animations
- https://emilkowal.ski/ui/7-practical-animation-tips
- https://emilkowal.ski/ui/building-a-drawer-component
- https://animations.dev/
- https://animations.dev/learn/animation-theory/the-easing-blueprint
- https://raw.githubusercontent.com/emilkowalski/sonner/main/src/styles.css
- https://raw.githubusercontent.com/emilkowalski/vaul/main/src/style.css
- https://raw.githubusercontent.com/emilkowalski/vaul/main/src/constants.ts
- https://www.w3.org/TR/css-easing-2/
- https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function
- https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear
- https://developer.mozilla.org/en-US/docs/Web/CSS/transition
- https://developer.mozilla.org/en-US/docs/Web/CSS/animation
- https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
- https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- https://web.dev/articles/animations-guide
- https://web.dev/articles/animations-and-performance
- https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- https://web.dev/articles/prefers-reduced-motion
- https://developer.chrome.com/blog/hardware-accelerated-animations
- https://developer.chrome.com/docs/css-ui/animate-to-height-auto
- https://base-ui.com/react/handbook/animation
- https://base-ui.com/react/components/accordion
- https://developer.apple.com/design/human-interface-guidelines/motion
- https://developer.apple.com/design/human-interface-guidelines/accessibility
- https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss
- https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
