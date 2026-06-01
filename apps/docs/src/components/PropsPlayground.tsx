'use client'

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'

// Schema entry: a discriminated union keyed on `type`. Adding a new control
// kind = adding a new union member + a branch in PropRow. The schema is the
// only source of truth — initial state is derived from `default` fields.
//
// Note on the `colors` default type: the parent schema is `readonly` so
// declaration order is preserved and entries can't be mutated, but each
// individual entry's `default` is a plain mutable type (e.g., `string[]`)
// because consumers expect to spread defaults into a state object and the
// extra `readonly` only adds friction. This is a deliberate asymmetry.
export type PropSchemaEntry =
  | { name: string; label?: string; type: 'color'; default: string }
  | {
      name: string
      label?: string
      type: 'number'
      default: number
      min: number
      max: number
      step?: number
    }
  | { name: string; label?: string; type: 'boolean'; default: boolean }
  | {
      name: string
      label?: string
      type: 'enum'
      default: string
      options: readonly string[]
    }
  | {
      name: string
      label?: string
      type: 'colors'
      default: string[]
      min?: number
      max?: number
    }

export type PropSchema = readonly PropSchemaEntry[]

export type PropValue = string | number | boolean | string[]
export type PropsState = Record<string, PropValue>

// A schema entry paired with its current value. Each variant locks the entry
// type to the matching value type — narrowing the top-level `type` discriminant
// narrows both `entry` and `value` together. This is what PropRow consumes so
// it can read `live.value` without any `as` casts.
//
// We duplicate `type` at the top level (it also lives on `entry.type`) because
// TypeScript narrows reliably on top-level discriminants but is fragile on
// nested ones — the duplication is the price of stable narrowing.
type LiveEntry =
  | {
      type: 'color'
      entry: Extract<PropSchemaEntry, { type: 'color' }>
      value: string
    }
  | {
      type: 'enum'
      entry: Extract<PropSchemaEntry, { type: 'enum' }>
      value: string
    }
  | {
      type: 'number'
      entry: Extract<PropSchemaEntry, { type: 'number' }>
      value: number
    }
  | {
      type: 'boolean'
      entry: Extract<PropSchemaEntry, { type: 'boolean' }>
      value: boolean
    }
  | {
      type: 'colors'
      entry: Extract<PropSchemaEntry, { type: 'colors' }>
      value: string[]
    }

// Runtime boundary: zip a schema entry with its state value into the strict
// LiveEntry union. Throws if state and schema have drifted (programmer error)
// or if the key is missing from state — caught at the dev seam instead of
// silently rendering the wrong widget. Mirrors the buildPrimitiveParams pattern
// in PrimitiveScene.tsx.
function toLiveEntry(entry: PropSchemaEntry, value: PropValue | undefined): LiveEntry {
  if (value === undefined) {
    throw new Error(`PropRow: missing state value for '${entry.name}'`)
  }

  switch (entry.type) {
    case 'color':
      if (typeof value !== 'string') {
        throw new Error(`PropRow: expected string for '${entry.name}', got ${typeof value}`)
      }

      return { type: 'color', entry, value }
    case 'enum':
      if (typeof value !== 'string') {
        throw new Error(`PropRow: expected string for '${entry.name}', got ${typeof value}`)
      }

      return { type: 'enum', entry, value }
    case 'number':
      if (typeof value !== 'number') {
        throw new Error(`PropRow: expected number for '${entry.name}', got ${typeof value}`)
      }

      return { type: 'number', entry, value }
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`PropRow: expected boolean for '${entry.name}', got ${typeof value}`)
      }

      return { type: 'boolean', entry, value }
    case 'colors':
      if (!Array.isArray(value)) {
        throw new Error(`PropRow: expected array for '${entry.name}', got ${typeof value}`)
      }

      return { type: 'colors', entry, value }
  }
}

export function initialStateFromSchema(schema: PropSchema): PropsState {
  const out: PropsState = {}

  for (const entry of schema) {
    // Clone arrays so callers that mutate state can't reach back into the
    // schema's default literal.
    out[entry.name] = entry.type === 'colors' ? [...entry.default] : entry.default
  }

  return out
}

interface PropsPlaygroundProps {
  schema: PropSchema
  onChange: (state: PropsState) => void
  className?: string
  style?: CSSProperties
}

export function PropsPlayground({ schema, onChange, className, style }: PropsPlaygroundProps) {
  const [state, setState] = useState<PropsState>(() => initialStateFromSchema(schema))

  // Fire onChange whenever the local state object changes. The parent should
  // pass a stable callback (useCallback or a setState ref) — this hook
  // intentionally depends on `onChange` so a freshly-bound callback won't be
  // missed, but parents that pass a fresh function each render will trigger
  // an extra fire on every parent render. Document this in the consumer page
  // by using `useState`'s setter directly (which IS stable).
  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  const update = (name: string, value: PropValue) => {
    setState((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form
      aria-label="Live property controls"
      className={className}
      onSubmit={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        ...style,
      }}
    >
      {schema.map((entry) => (
        <PropRow key={entry.name} live={toLiveEntry(entry, state[entry.name])} onChange={update} />
      ))}
    </form>
  )
}

function PropRow({
  live,
  onChange,
}: {
  live: LiveEntry
  onChange: (name: string, value: PropValue) => void
}) {
  const label = live.entry.label ?? live.entry.name
  const id = `prop-${live.entry.name}`

  switch (live.type) {
    case 'color':
      return (
        <Field id={id} label={label}>
          <input
            id={id}
            onChange={(e) => onChange(live.entry.name, e.target.value)}
            style={{
              width: 40,
              height: 28,
              padding: 0,
              border: 'none',
              background: 'transparent',
            }}
            type="color"
            value={live.value}
          />
          <code style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{live.value}</code>
        </Field>
      )

    case 'number': {
      const step = live.entry.step ?? 0.01
      // Decimal places for the readout — derived from step so integer-stepped
      // sliders (angle: 1°) show whole numbers and fine-stepped sliders
      // (speed: 0.01) show two decimals.
      const fractionDigits = step >= 1 ? 0 : Math.min(3, -Math.floor(Math.log10(step)))

      return (
        <Field id={id} label={label}>
          <input
            id={id}
            max={live.entry.max}
            min={live.entry.min}
            onChange={(e) => onChange(live.entry.name, e.target.value)}
            step={step}
            style={{ flex: 1 }}
            type="range"
            value={live.value}
          />
          <code
            style={{
              width: 60,
              textAlign: 'right',
              fontSize: '0.8rem',
              color: 'var(--fg-muted)',
            }}
          >
            {live.value.toFixed(fractionDigits)}
          </code>
        </Field>
      )
    }

    case 'boolean':
      return (
        <Field id={id} label={label}>
          <input
            checked={live.value}
            id={id}
            onChange={(e) => onChange(live.entry.name, e.target.checked)}
            type="checkbox"
          />
        </Field>
      )

    case 'enum':
      return (
        <Field id={id} label={label}>
          <select
            id={id}
            onChange={(e) => onChange(live.entry.name, e.target.value)}
            style={{
              flex: 1,
              padding: '0.25rem 0.5rem',
              background: 'var(--bg)',
              color: 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
            value={live.value}
          >
            {live.entry.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
      )

    case 'colors':
      return (
        <Field id={id} label={label}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {live.value.map((c, i) => (
              <input
                aria-label={`${label} ${i + 1}`}
                key={i}
                onChange={(e) => {
                  const next = [...live.value]

                  next[i] = e.target.value
                  onChange(live.entry.name, next)
                }}
                style={{
                  width: 32,
                  height: 28,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                }}
                type="color"
                value={c}
              />
            ))}
          </div>
        </Field>
      )
  }
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
      }}
    >
      <span style={{ width: 100, color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
