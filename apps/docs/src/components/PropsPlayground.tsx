'use client';

import type { CSSProperties, ReactNode } from 'react';

export type PropSchemaEntry =
  | { name: string; label?: string; type: 'color'; default: string }
  | {
      name: string;
      label?: string;
      type: 'number';
      default: number;
      min: number;
      max: number;
      step?: number;
    }
  | { name: string; label?: string; type: 'boolean'; default: boolean }
  | {
      name: string;
      label?: string;
      type: 'enum';
      default: string;
      options: readonly string[];
    }
  | {
      name: string;
      label?: string;
      type: 'colors';
      default: string[];
      min?: number;
      max?: number;
    };

export type PropSchema = readonly PropSchemaEntry[];

export type PropValue = string | number | boolean | string[];
export type PropsState = Record<string, PropValue>;

type LiveEntry =
  | {
      type: 'color';
      entry: Extract<PropSchemaEntry, { type: 'color' }>;
      value: string;
    }
  | {
      type: 'enum';
      entry: Extract<PropSchemaEntry, { type: 'enum' }>;
      value: string;
    }
  | {
      type: 'number';
      entry: Extract<PropSchemaEntry, { type: 'number' }>;
      value: number;
    }
  | {
      type: 'boolean';
      entry: Extract<PropSchemaEntry, { type: 'boolean' }>;
      value: boolean;
    }
  | {
      type: 'colors';
      entry: Extract<PropSchemaEntry, { type: 'colors' }>;
      value: string[];
    };

function toLiveEntry(entry: PropSchemaEntry, value: PropValue | undefined): LiveEntry {
  if (value === undefined) {
    throw new Error(`PropRow: missing state value for '${entry.name}'`);
  }

  switch (entry.type) {
    case 'color':
      if (typeof value !== 'string') {
        throw new Error(`PropRow: expected string for '${entry.name}', got ${typeof value}`);
      }

      return { type: 'color', entry, value };
    case 'enum':
      if (typeof value !== 'string') {
        throw new Error(`PropRow: expected string for '${entry.name}', got ${typeof value}`);
      }

      return { type: 'enum', entry, value };
    case 'number':
      if (typeof value !== 'number') {
        throw new Error(`PropRow: expected number for '${entry.name}', got ${typeof value}`);
      }

      return { type: 'number', entry, value };
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`PropRow: expected boolean for '${entry.name}', got ${typeof value}`);
      }

      return { type: 'boolean', entry, value };
    case 'colors':
      if (!Array.isArray(value)) {
        throw new Error(`PropRow: expected array for '${entry.name}', got ${typeof value}`);
      }

      return { type: 'colors', entry, value };
  }
}

interface PropsPlaygroundProps {
  schema: PropSchema;
  state: PropsState;
  onChange: (state: PropsState) => void;
  className?: string;
  style?: CSSProperties;
}

// Controlled on purpose: the parent owns the state and this panel only
// reports edits. Holding a mirror copy here and syncing it up through an
// effect would render every change twice (once for the local set, once for
// the parent's).
export function PropsPlayground({
  schema,
  state,
  onChange,
  className,
  style,
}: PropsPlaygroundProps) {
  const update = (name: string, value: PropValue) => {
    onChange({ ...state, [name]: value });
  };

  return (
    <div
      aria-label="Live property controls"
      className={className}
      role="group"
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
    </div>
  );
}

function PropRow({
  live,
  onChange,
}: {
  live: LiveEntry;
  onChange: (name: string, value: PropValue) => void;
}) {
  const label = live.entry.label ?? live.entry.name;
  const id = `prop-${live.entry.name}`;

  switch (live.type) {
    case 'color':
      return (
        <Field id={id} label={label}>
          <input
            id={id}
            onChange={(event) => onChange(live.entry.name, event.target.value)}
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
      );

    case 'number': {
      const step = live.entry.step ?? 0.01;

      const fractionDigits = step >= 1 ? 0 : Math.min(3, -Math.floor(Math.log10(step)));

      return (
        <Field id={id} label={label}>
          <input
            id={id}
            max={live.entry.max}
            min={live.entry.min}
            onChange={(event) => onChange(live.entry.name, event.target.value)}
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
      );
    }

    case 'boolean':
      return (
        <Field id={id} label={label}>
          <input
            checked={live.value}
            id={id}
            onChange={(event) => onChange(live.entry.name, event.target.checked)}
            type="checkbox"
          />
        </Field>
      );

    case 'enum':
      return (
        <Field id={id} label={label}>
          <select
            id={id}
            onChange={(event) => onChange(live.entry.name, event.target.value)}
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
            {live.entry.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'colors':
      return (
        <Field id={id} label={label}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {live.value.map((colorValue, colorIndex) => (
              <input
                aria-label={`${label} ${colorIndex + 1}`}
                key={colorIndex}
                onChange={(event) => {
                  const next = [...live.value];

                  next[colorIndex] = event.target.value;
                  onChange(live.entry.name, next);
                }}
                style={{
                  width: 32,
                  height: 28,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                }}
                type="color"
                value={colorValue}
              />
            ))}
          </div>
        </Field>
      );
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
  );
}
