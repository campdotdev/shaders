# A composition stacks only public Sources and Effects and lives in a typed document

Status: Accepted. Nothing is built yet. The Gallery project's first milestone in Linear builds the first composition.

Shaders picked its next component from shaders.com's catalog (SHA-124), and the docs showed each Source alone and each Effect over a default `<MeshGradient />`. Shaders.com ships 200 components and sells finished shaders built from them. React Bits ships finished backgrounds as sealed single files. Next to both, Shaders offered parts and no finished pieces. These figures come from shaders.com's `llms.txt` and docs and from the React Bits repo, read on 2026-10-28.

We chose to lead with a Gallery of finished compositions, and to build a new Source or Effect only when a composition needs it. A composition stacks only public Sources and Effects with set props. Each one is a TypeScript document: a `stack` of Sources and Effects whose props are typed against each component, plus presets. The docs render the document, copying a composition generates a component file from it, and a later editor will edit the same document.

## Considered options

- **Export each composition from the package,** as in `<Ember />`. Rejected: a user who wants more than its props has to rewrite it, and every composition becomes a semver commitment.
- **Hand-written JSX as the source of truth.** Rejected: a composition's control panel changes props. A hand-written file supports that only with a second copy as data, which drifts from the first, or with props of its own that map onto the stack. That mapping is code the user then copies.
- **Let a composition carry its own TSL, hooks, or animation code.** Rejected: the copied file grows to hundreds of lines, an editor can't change it safely, and the next composition can't reuse that code.

## Consequences

- When a composition needs something the public components can't do, that gap becomes a new Source, a new Effect, a new prop, or engine work, and it lands before the composition does. SHA-124 is a list of parts to pull from, not a queue.
- Each control in a composition's control panel sets exactly one prop. A control that sets two props needs a mapping from one value to two, and the document format gains one only when a composition needs it.
- The copied file holds literal props for the control panel's current state, so it doesn't pick up later improvements to the composition.
- Every composition renders on the WebGL2 fallback. Shaders.com is WebGPU-only and draws nothing there. CI's headless Chromium already runs WebGL2. Each composition's visual spec asserts the backend, so a runner that gains WebGPU can't drop that coverage without a failure.
- Composition code lives in `apps/docs`. When an editor app needs it too, it moves to a private workspace package, never into `@camp-dev/shaders`. Compositions add no exports to the published package.
