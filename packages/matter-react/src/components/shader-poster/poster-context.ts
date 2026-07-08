import { type Context, createContext } from 'react';

export interface PosterContextValue {
  /**
   * Signals whether the shader scene inside the poster boundary currently has
   * a real content frame on screen. ShaderScene calls this with true on the
   * frame after its first content paint, and with false when its renderer is
   * torn down (e.g. a gamut change) and must re-prove its first paint.
   */
  setShaderPainted: (painted: boolean) => void;
}

// This module is bundled into BOTH package entries (index and poster), and
// esbuild cannot code-split CJS output, so two evaluated copies are a real
// scenario. Register the context on globalThis under a global-registry symbol
// so every copy resolves to the single context created first — otherwise the
// ShaderPoster provider and the ShaderScene consumer would hold different
// context objects and the poster would never dismiss.
//
// Because this key is shared across independently-versioned copies of the
// package, `PosterContextValue`'s shape is a forever-contract for the
// lifetime of this key: any future change to it must stay backward-compatible
// with older copies reading/writing the same global slot, or the key itself
// must be bumped (e.g. to `@lovo/matter-react:poster-context/v2`) so
// incompatible shapes don't collide.
const POSTER_CONTEXT_KEY = Symbol.for('@lovo/matter-react:poster-context');

const globalRegistry = globalThis as Record<symbol, unknown>;

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- globalThis registry values are untyped by nature; this narrows the one key this module owns.
const existingContext = globalRegistry[POSTER_CONTEXT_KEY] as
  | Context<PosterContextValue | null>
  | undefined;

export const PosterContext: Context<PosterContextValue | null> =
  existingContext ?? createContext<PosterContextValue | null>(null);

globalRegistry[POSTER_CONTEXT_KEY] = PosterContext;
