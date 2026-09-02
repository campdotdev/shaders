/**
 * The shiki theme for every CodeBlock on the site. Instead of hex colors it
 * emits `var(--code-*)` references, so the palette lives with the rest of
 * the semantic tokens in globals.css and the theme only decides which
 * TextMate scope maps to which role. Registered by lib/shiki.ts.
 */
import type { ThemeRegistration } from 'shiki';

// ----------------------------------------------------------------------------
// Role model
// ----------------------------------------------------------------------------
// One hue, stepped by lightness. The language itself (keywords) sits at full
// lime, names you call (tags, functions) one step lighter, literal values
// (strings, numbers, booleans) palest, prop names in white so a JSX line
// keeps its tag and props apart, and the structure (punctuation, operators,
// comments) recedes into gray. Identifiers and object keys stay plain.

const plain = 'var(--code-plain)';
const keyword = 'var(--code-keyword)';
const name = 'var(--code-name)';
const literal = 'var(--code-literal)';
const prop = 'var(--code-prop)';
const punctuation = 'var(--code-punctuation)';
const comment = 'var(--code-comment)';

// ----------------------------------------------------------------------------
// Scope rules
// ----------------------------------------------------------------------------
// TextMate picks the most specific matching selector, so `keyword.operator`
// beats `keyword` and `keyword.operator.new` beats both. Rule order only
// breaks ties. Symbol operators (`=`, `|`, `<` in a generic) read as
// structure, while wordlike ones (`new`, `typeof`, `keyof`) read as keywords.

export const CODE_THEME_NAME = 'shaders';

export const CODE_THEME: ThemeRegistration = {
  name: CODE_THEME_NAME,
  type: 'dark',
  colors: {
    'editor.foreground': plain,
    'editor.background': 'var(--code-bg)',
  },
  tokenColors: [
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'variable.language'],
      settings: { foreground: keyword },
    },
    { scope: 'keyword.operator', settings: { foreground: punctuation } },
    {
      scope: ['keyword.operator.new', 'keyword.operator.expression'],
      settings: { foreground: keyword },
    },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: punctuation } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: literal } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: literal } },
    {
      scope: ['entity.name.tag', 'entity.name.function', 'support.function'],
      settings: { foreground: name },
    },
    {
      scope: ['entity.other.attribute-name', 'support.type.property-name.json'],
      settings: { foreground: prop },
    },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: comment } },
  ],
};
