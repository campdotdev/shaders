// Type augmentation for @testing-library/jest-dom matchers.
//
// @testing-library/jest-dom/vitest augments `Assertion` on the `'vitest'`
// module, but vite-plus-test (which provides the `vitest` module via the
// pnpm catalog alias) re-exports `Assertion` from an internal chunk — so
// the module-augmentation never reaches the interface returned by `expect()`.
//
// vite-plus-test's `Assertion` extends `JestAssertion`, which extends the
// global `jest.Matchers` interface (declared via `declare global` in the
// chunk itself). That global *is* reachable from outside the package, so
// we add the testing-library matchers there.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare global {
  namespace jest {
    // oxlint-disable-next-line typescript/no-empty-object-type -- matches vite-plus-test's own `interface Matchers<R, T = {}>` declaration; the body is empty because all members are inherited.
    interface Matchers<R = void, T = object> extends TestingLibraryMatchers<unknown, R> {}
  }
}

export {}
