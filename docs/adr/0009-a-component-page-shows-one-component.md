# A component page shows one component, and stacks belong to the Gallery

Status: Accepted. SHA-340 moves the component demos, and SHA-327 removes Swells' `mirage`.

ADR 0005 made the Gallery the home for finished stacks, but the component pages kept an older habit. Twelve of the 26 demos mount a second Source under the component the page is about: Blobs draws over a LinearGradient, and eleven Effects draw over a gradient or a noise field. Swells went further and built an Effect's job into itself. Its `mirage` prop wavered the far surface by nudging where each pixel looked, which is a UV warp in all but name. On those pages a visitor can't tell which part of the picture comes from the component.

We chose to give each component page one component:

- A Source's page shows the Source alone. Where the Source is transparent, as above Swells' horizon, the page's background shows through.
- An Effect's page shows the Effect over a photo and nothing else. The docs app's `PhotoSource` draws the photo. `PhotoSource` is a docs helper, not a library Source. A photo has edges, detail, and a range of light and dark, so a resample or a color transform shows plainly on it.
- A component doesn't take on another component's job. An effect that would act the same way on any image beneath it, such as a shimmer that wavers the picture, is an Effect of its own. It is built when a composition needs it, as ADR 0005 says, and it is not a prop on a Source.
- Every stack of two or more components lives in a Gallery composition, never on a component page.

## Considered options

- **Draw every Effect over a checkerboard,** as shaders.com did when we read its docs on 2026-11-16. Rejected because a checkerboard shows that an Effect is transparent, not what the Effect does to an image.
- **Keep a default Source under each Effect,** as the docs did with MeshGradient. Rejected because the Source's color and motion mix with the Effect's, so the page shows a stack that the Gallery doesn't list.

## Consequences

- Every Effect demo needs a photo that the site can ship.
- A Source keeps the props that change only its own pixels. Swells keeps `sheen`, which lights its swells, and `haze`, which shifts their color and alpha with distance. Both act on what Swells draws, never on the image beneath. Swells also keeps `intro`, because ADR 0007 makes an intro part of its Source. Swells loses `mirage`.
- A composition that wants a shimmer gets it from a new Effect, which then works over any Source.
