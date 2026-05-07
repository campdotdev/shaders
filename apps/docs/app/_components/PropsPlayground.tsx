'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

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
  | { name: string; label?: string; type: 'enum'; default: string; options: readonly string[] }
  | { name: string; label?: string; type: 'colors'; default: string[]; min?: number; max?: number }

export type PropSchema = readonly PropSchemaEntry[]

export type PropValue = string | number | boolean | string[]
export type PropsState = Record<string, PropValue>

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
        <PropRow
          key={entry.name}
          entry={entry}
          value={state[entry.name] as PropValue}
          onChange={update}
        />
      ))}
    </form>
  )
}

function PropRow({
  entry,
  value,
  onChange,
}: {
  entry: PropSchemaEntry
  value: PropValue
  onChange: (name: string, value: PropValue) => void
}) {
  const label = entry.label ?? entry.name
  const id = `prop-${entry.name}`

  if (entry.type === 'color') {
    const v = value as string
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="color"
          value={v}
          onChange={(e) => onChange(entry.name, e.target.value)}
          style={{ width: 40, height: 28, padding: 0, border: 'none', background: 'transparent' }}
        />
        <code style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{v}</code>
      </Field>
    )
  }

  if (entry.type === 'number') {
    const v = value as number
    const step = entry.step ?? 0.01
    // Decimal places for the readout — derived from step so integer-stepped
    // sliders (angle: 1°) show whole numbers and fine-stepped sliders
    // (speed: 0.01) show two decimals.
    const fractionDigits = step >= 1 ? 0 : Math.min(3, -Math.floor(Math.log10(step)))
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="range"
          min={entry.min}
          max={entry.max}
          step={step}
          value={v}
          onChange={(e) => onChange(entry.name, Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <code
          style={{
            width: 60,
            textAlign: 'right',
            fontSize: '0.8rem',
            color: 'var(--fg-muted)',
          }}
        >
          {v.toFixed(fractionDigits)}
        </code>
      </Field>
    )
  }

  if (entry.type === 'boolean') {
    const v = value as boolean
    return (
      <Field id={id} label={label}>
        <input
          id={id}
          type="checkbox"
          checked={v}
          onChange={(e) => onChange(entry.name, e.target.checked)}
        />
      </Field>
    )
  }

  if (entry.type === 'enum') {
    const v = value as string
    return (
      <Field id={id} label={label}>
        <select
          id={id}
          value={v}
          onChange={(e) => onChange(entry.name, e.target.value)}
          style={{
            flex: 1,
            padding: '0.25rem 0.5rem',
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          {entry.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  // type === 'colors' — array of hex strings.
  const colors = value as string[]
  return (
    <Field id={id} label={label}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {colors.map((c, i) => (
          <input
            key={i}
            type="color"
            value={c}
            onChange={(e) => {
              const next = [...colors]
              next[i] = e.target.value
              onChange(entry.name, next)
            }}
            aria-label={`${label} ${i + 1}`}
            style={{ width: 32, height: 28, padding: 0, border: 'none', background: 'transparent' }}
          />
        ))}
      </div>
    </Field>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
    >
      <span style={{ width: 100, color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
