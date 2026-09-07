// The editor's single serialization format: the "unit of currency" that file
// export/import, URL sharing, undo snapshots, and the clipboard all read and
// write. Parsing never silently drops a node -- anything the loader can't
// trust to be safe (an unknown spec, an edge into a handle that doesn't
// exist, a version from the future) throws a PresetError carrying a message
// meant to be shown to a human. Anything it CAN safely repair (a missing
// param, an out-of-range slider, a malformed ramp) is coerced back onto the
// spec's default instead of failing the whole load.
//
// Zod owns the shape and the coercion: every check below is a schema, and
// `.catch(default)` is the repair rule. What Zod cannot see stays as a second
// pass after the parse: node ids have to be unique, and an edge has to land
// on a node and an input handle that exist in the parsed set. This file used
// to be hand-rolled to stay dependency-free for the three-free code emitter;
// Zod is pure and pulls in no renderer, so that concern does not apply to it.
import { parseColorString } from '@camp-dev/shaders/color';
import { z } from 'zod';

import type { ParamSpec, ParamValue, SpecId } from '@/editor/graph/registry';
import { NODE_SPECS, xyKeysOf } from '@/editor/graph/registry';

/** Current preset format version. Bump alongside a MIGRATIONS entry whenever the shape changes. */
export const PRESET_VERSION = 1;

/** One saved node: which spec it is, where it sits on the canvas, and its dial values. */
export interface PresetNode {
  id: string;
  spec: SpecId;
  position: { x: number; y: number };
  params: Record<string, ParamValue>;
}

/**
 * One saved wire. Unlike the live-graph `GraphEdge`, `targetHandle` is
 * always present here -- a preset is data at rest, so there's no "assume the
 * first input" fallback the way an in-progress canvas edit might lean on.
 */
export interface PresetEdge {
  source: string;
  target: string;
  targetHandle: string;
}

/** The full saved shape of a graph: a version tag plus its nodes and edges. */
export interface Preset {
  version: number;
  nodes: PresetNode[];
  edges: PresetEdge[];
}

/** Thrown by `parsePreset` for anything the loader can't safely repair. The
    message is written to be read by a person in a toast, not grepped from a log. */
export class PresetError extends Error {}

/**
 * The loose shape migrations operate on. A migration's whole job is to turn
 * data that does NOT yet match the current `Preset` shape into data that
 * does, so typing its input as `Preset` would be a lie -- this plain
 * string-keyed bag is what a parsed-but-not-yet-validated preset actually is.
 */
type PresetLike = Record<string, unknown>;

/**
 * Per-version upgrade steps, keyed by the version they upgrade FROM. Empty
 * today -- format version 1 is the first shape this editor has ever shipped
 * -- but the walk in `parsePreset` already runs every step between a
 * preset's saved version and `PRESET_VERSION`, so landing the next breaking
 * change is just adding an entry here, not touching the walk itself.
 */
const MIGRATIONS: Record<number, (preset: PresetLike) => PresetLike> = {};

/**
 * Test-only escape hatch for registering a migration at runtime, so the
 * "the version walk actually runs a migration" test doesn't need its own
 * copy of MIGRATIONS. Production migrations are added as literal entries in
 * the map above when PRESET_VERSION bumps, not through this function.
 *
 * Returns an unregister callback so a test can clean up after itself instead
 * of leaving a migration permanently mutating module state for every test
 * that runs afterward in the same process.
 */
export function __registerMigrationForTests(
  fromVersion: number,
  migrate: (preset: PresetLike) => PresetLike,
): () => void {
  MIGRATIONS[fromVersion] = migrate;

  return () => {
    Reflect.deleteProperty(MIGRATIONS, fromVersion);
  };
}

// ---------------------------------------------------------------------------
// Write side
// ---------------------------------------------------------------------------

/** Builds a fresh preset at the current version from a graph's nodes and edges. */
export function presetFrom(nodes: PresetNode[], edges: PresetEdge[]): Preset {
  return { version: PRESET_VERSION, nodes, edges };
}

/**
 * Serializes with a fixed field order -- version, nodes, edges; each node as
 * id/spec/position/params; each edge as source/target/targetHandle -- so two
 * semantically identical presets always produce byte-identical JSON. That
 * determinism is what the round-trip test checks, and it's also what makes a
 * saved preset file diff cleanly.
 */
export function serializePreset(preset: Preset): string {
  const ordered: Preset = {
    version: preset.version,
    nodes: preset.nodes.map((node) => ({
      id: node.id,
      spec: node.spec,
      position: { x: node.position.x, y: node.position.y },
      params: node.params,
    })),
    edges: preset.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      targetHandle: edge.targetHandle,
    })),
  };

  return JSON.stringify(ordered, null, 2);
}

// ---------------------------------------------------------------------------
// Read side: the schemas
// ---------------------------------------------------------------------------

/**
 * The version envelope, checked BEFORE migrations run, on the loose bag they
 * operate on. Versions above `PRESET_VERSION` come from a newer editor and
 * can't be understood, so they fail loudly rather than falling through to
 * node validation and producing a confusing downstream error. Versions below
 * zero aren't just invalid, they're dangerous: the migration walk in
 * `parsePreset` counts up from the saved version to `PRESET_VERSION` one step
 * at a time, so a very negative version would spin through billions of no-op
 * loop iterations before ever reaching the shape check that would otherwise
 * catch it. Zero stays valid -- it's the version below this format's first
 * shape, which is what the migration-walk test exercises.
 * Each check carries its own toast wording; `issue.input` is the raw value.
 */
const integerMessage = (issue: { input: unknown }) =>
  `Preset version must be an integer (got ${JSON.stringify(issue.input)}).`;

const envelopeSchema = z.looseObject(
  {
    version: z
      .number({ error: integerMessage })
      .int({ error: integerMessage })
      .max(PRESET_VERSION, {
        error: (issue) =>
          `This preset needs a newer editor (preset version ${String(issue.input)}, editor supports ${PRESET_VERSION}).`,
      })
      .min(0, {
        error: (issue) => `Preset version must not be negative (got ${String(issue.input)}).`,
      }),
  },
  { error: 'Preset must be a JSON object.' },
);

/** A number, or the fallback. `z.number()` already rejects NaN and the infinities, which are not dial values. */
const numberOr = (fallback: number) => z.number().catch(fallback);

/** A saved canvas position, each axis repaired on its own and the origin if
    the whole thing is missing. The origin is built per fallback: a static
    `.catch` value is handed back as the same object every time, and two nodes
    must never share one mutable position. */
const positionSchema = z.object({ x: numberOr(0), y: numberOr(0) }).catch(() => ({ x: 0, y: 0 }));

/** Does the engine's own decoder accept this color? Anything it rejects here
    would otherwise throw much later, in pushPresetToStore or the compiler,
    past the point where a PresetError toast could catch it. */
function isDecodableColor(value: string): boolean {
  try {
    parseColorString(value);

    return true;
  } catch {
    return false;
  }
}

/** A number clamped into `[min, max]`; the repair for a slider that drifted out of range. */
function clampedNumber(min: number, max: number) {
  return z.number().transform((value) => Math.min(max, Math.max(min, value)));
}

/**
 * A ramp must be an array of 2-8 `{ color, position }` stops with colors the
 * engine can decode, or the whole param resets to the spec default -- there's
 * no safe way to patch a ramp missing a stop's color, so this doesn't try to
 * fix individual entries. A well-formed ramp keeps its stops but clamps each
 * position into 0..1, since a stop past either end of the ramp is just a
 * mispositioned stop, not a broken one.
 */
const rampSchema = z
  .array(
    z.object({
      color: z.string().refine(isDecodableColor),
      position: clampedNumber(0, 1),
    }),
  )
  .min(2)
  .max(8);

/**
 * The schema for one param's saved value: the well-formed case passes
 * through (clamped for sliders, checked against `options` for selects,
 * decoded for colors, shape-checked for ramps) and `.catch` turns anything
 * else, including a missing value, into the spec default. The ramp default
 * is cloned per catch, because a shared array would be aliased across every
 * node that fell back to it.
 */
function paramValueSchema(paramSpec: Exclude<ParamSpec, { kind: 'xy' }>): z.ZodType<ParamValue> {
  switch (paramSpec.kind) {
    case 'slider':
      return clampedNumber(paramSpec.min, paramSpec.max).catch(paramSpec.defaultValue);
    case 'select':
      return z.enum(paramSpec.options).catch(paramSpec.defaultValue);
    case 'color':
      return z.string().refine(isDecodableColor).catch(paramSpec.defaultValue);
    case 'ramp':
      return rampSchema.catch(() => structuredClone(paramSpec.defaultValue));
  }
}

/** One axis of an xy param: a clamped number, or that axis's default. */
function axisSchema(paramSpec: Extract<ParamSpec, { kind: 'xy' }>, axis: number) {
  return clampedNumber(paramSpec.min, paramSpec.max).catch(
    paramSpec.defaultValue[axis] ?? paramSpec.min,
  );
}

/**
 * The params schema for a spec, built once from its declared param list and
 * in that list's order. `z.object` is what does the rest of the work: every
 * declared id gets a value (its schema repairs a missing one), any saved id
 * the spec doesn't declare is dropped, and the output keys come out in
 * declaration order, which is what keeps `serializePreset` canonical
 * regardless of the order params happened to appear in on disk.
 */
const paramsSchemas = new Map<SpecId, z.ZodType<Record<string, ParamValue>>>();

function paramsSchemaFor(spec: SpecId): z.ZodType<Record<string, ParamValue>> {
  const cached = paramsSchemas.get(spec);

  if (cached) return cached;

  const shape: Record<string, z.ZodType<ParamValue>> = {};

  for (const paramSpec of NODE_SPECS[spec].params) {
    // An xy param owns TWO storage keys (`${id}.x` / `${id}.y`), each a
    // plain clamped number, mirroring defaultParamsOf's expansion.
    if (paramSpec.kind === 'xy') {
      xyKeysOf(paramSpec.id).forEach((key, axis) => {
        shape[key] = axisSchema(paramSpec, axis);
      });
    } else {
      shape[paramSpec.id] = paramValueSchema(paramSpec);
    }
  }

  const schema = z.object(shape);

  paramsSchemas.set(spec, schema);

  return schema;
}

const unknownSpecMessage = (issue: { input: unknown }) =>
  `Unknown node type "${String(issue.input)}" — this preset may come from a newer editor.`;

/**
 * One node. The spec must exist in the registry: an unknown spec means the
 * preset came from a newer editor and there's no safe default to fall back
 * to, so it fails rather than dropping the node. The params bag is then run
 * through that spec's own schema, which is why it is a transform rather than
 * a field: which schema applies depends on the sibling `spec` value.
 */
const nodeSchema = z
  .object(
    {
      id: z.string({ error: 'is missing a string "id".' }).min(1, 'is missing a string "id".'),
      spec: z
        .string({ error: unknownSpecMessage })
        .refine((value): value is SpecId => value in NODE_SPECS, { error: unknownSpecMessage }),
      position: positionSchema,
      params: z.record(z.string(), z.unknown()).catch({}),
    },
    { error: 'must be an object.' },
  )
  .transform(
    (node): PresetNode => ({
      id: node.id,
      spec: node.spec,
      position: node.position,
      params: paramsSchemaFor(node.spec).parse(node.params),
    }),
  );

/** One wire's shape. Whether its endpoints exist is the second pass's job. */
const edgeSchema = z.object(
  {
    source: z.string({ error: 'is missing a string "source".' }),
    target: z.string({ error: 'is missing a string "target".' }),
    targetHandle: z.string({ error: 'is missing a string "targetHandle".' }),
  },
  { error: 'must be an object.' },
);

/** The post-migration shape: the two arrays, each element checked by its own schema. */
const arraysMessage = 'Preset must contain "nodes" and "edges" arrays.';

const presetShapeSchema = z.object({
  nodes: z.array(nodeSchema, { error: arraysMessage }),
  edges: z.array(edgeSchema, { error: arraysMessage }),
});

// ---------------------------------------------------------------------------
// Read side: the parse
// ---------------------------------------------------------------------------

/**
 * Turns a Zod failure into the PresetError a toast shows. Only the first
 * issue is reported, because one clear sentence beats a list, and an issue
 * inside a node or edge is prefixed with where it sits so the reader can
 * find it in the file. A message written as a predicate ("is missing a
 * string "id".") continues the prefix; one written as a sentence ("Unknown
 * node type ...") follows it after a colon.
 */
function toPresetError(error: z.ZodError): PresetError {
  const issue = error.issues[0];

  if (!issue) return new PresetError('Preset is invalid.');

  const [collection, index] = issue.path;

  if (typeof index !== 'number' || (collection !== 'nodes' && collection !== 'edges')) {
    return new PresetError(issue.message);
  }

  const where = `${collection === 'nodes' ? 'Node' : 'Edge'} at index ${index}`;
  const joiner = /^[A-Z]/.test(issue.message) ? ': ' : ' ';

  return new PresetError(`${where}${joiner}${issue.message}`);
}

/** Runs a schema and converts its failure into a PresetError. */
function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) throw toPresetError(result.error);

  return result.data;
}

/** Wraps `JSON.parse` so a syntax error becomes a `PresetError` instead of a raw `SyntaxError`. */
function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new PresetError('Preset is not valid JSON.');
  }
}

/**
 * Parses and validates a saved preset. Runs in passes: check the version and
 * walk any registered migrations up to `PRESET_VERSION`, check every node's
 * spec exists and coerce its params onto that spec's shape, then check every
 * edge points at a node id and input handle that actually exist. Each pass
 * can throw; none of them drop a node silently.
 */
export function parsePreset(json: string): Preset {
  const envelope = parseWith(envelopeSchema, parseJson(json));

  let working: PresetLike = envelope;

  for (let walkedVersion = envelope.version; walkedVersion < PRESET_VERSION; walkedVersion += 1) {
    const migrate = MIGRATIONS[walkedVersion];

    if (migrate) {
      working = migrate(working);
    }
  }

  const shape = parseWith(presetShapeSchema, working);
  const nodesById = buildNodesById(shape.nodes);
  const edges = validateEdges(shape.edges, nodesById);

  return { version: PRESET_VERSION, nodes: shape.nodes, edges };
}

/**
 * Indexes validated nodes by id, rejecting duplicates instead of letting a
 * later node silently overwrite an earlier one in the map. A duplicate id
 * wouldn't just lose a node -- edges targeting that id would validate
 * against whichever node happened to win the overwrite, accepting edges
 * that don't actually match the intended node's spec and rejecting ones
 * that do, with no error to explain why.
 */
function buildNodesById(nodes: PresetNode[]): Map<string, PresetNode> {
  const nodesById = new Map<string, PresetNode>();

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new PresetError(`Duplicate node id "${node.id}" — node ids must be unique.`);
    }

    nodesById.set(node.id, node);
  }

  return nodesById;
}

/**
 * Checks every well-formed edge against the now-validated node set: both
 * endpoints must reference a node that exists, and `targetHandle` must be
 * one of the target node's declared inputs. Unlike params, there's no safe
 * coercion for a dangling wire -- it either connects two real ports or it's
 * dropped data, so a bad edge throws instead of being silently discarded.
 */
function validateEdges(edges: PresetEdge[], nodesById: Map<string, PresetNode>): PresetEdge[] {
  return edges.map(({ source, target, targetHandle }) => {
    if (!nodesById.has(source)) {
      throw new PresetError(`Edge references source node "${source}", which doesn't exist.`);
    }

    const targetNode = nodesById.get(target);

    if (!targetNode) {
      throw new PresetError(`Edge references target node "${target}", which doesn't exist.`);
    }

    const targetSpec = NODE_SPECS[targetNode.spec];

    if (!targetSpec.inputs.some((input) => input.id === targetHandle)) {
      throw new PresetError(
        `Edge into "${target}" references handle "${targetHandle}", which isn't an input on ${targetSpec.name}.`,
      );
    }

    return { source, target, targetHandle };
  });
}
