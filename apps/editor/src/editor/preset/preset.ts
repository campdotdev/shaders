// The editor's single serialization format: the "unit of currency" that file
// export/import, URL sharing, undo snapshots, and the clipboard all read and
// write. Parsing never silently drops a node -- anything the loader can't
// trust to be safe (an unknown spec, an edge into a handle that doesn't
// exist, a version from the future) throws a PresetError carrying a message
// meant to be shown to a human. Anything it CAN safely repair (a missing
// param, an out-of-range slider, a malformed ramp) is coerced back onto the
// spec's default instead of failing the whole load. Kept dependency-free
// (hand-rolled validation, no schema library) so every consumer -- including
// the code emitter, which stays three-free -- can pull it in cheaply.
import { parseColorString } from '@lovo/matter/color';

import type { ColorStop, ParamSpec, ParamValue, SpecId } from '@/editor/graph/registry';
import { NODE_SPECS } from '@/editor/graph/registry';

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
// Read side
// ---------------------------------------------------------------------------

/**
 * Parses and validates a saved preset. Runs in passes: check the version and
 * walk any registered migrations up to `PRESET_VERSION`, check every node's
 * spec exists and coerce its params onto that spec's shape, then check every
 * edge points at a node id and input handle that actually exist. Each pass
 * can throw; none of them drop a node silently.
 */
export function parsePreset(json: string): Preset {
  const raw = parseJson(json);

  if (!isRecord(raw)) {
    throw new PresetError('Preset must be a JSON object.');
  }

  assertValidVersion(raw.version);

  let working: PresetLike = raw;

  for (let walkedVersion = raw.version; walkedVersion < PRESET_VERSION; walkedVersion += 1) {
    const migrate = MIGRATIONS[walkedVersion];

    if (migrate) {
      working = migrate(working);
    }
  }

  if (!Array.isArray(working.nodes) || !Array.isArray(working.edges)) {
    throw new PresetError('Preset must contain "nodes" and "edges" arrays.');
  }

  const nodes = working.nodes.map((node, index) => validateNode(node, index));
  const nodesById = buildNodesById(nodes);
  const edges = validateEdges(working.edges, nodesById);

  return { version: PRESET_VERSION, nodes, edges };
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

/** Narrows `unknown` to a plain object without lying about its contents -- the
    one guard every other validator in this file is built on. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
 * Confirms `version` is an integer this editor can load. Versions above
 * `PRESET_VERSION` come from a newer editor and can't be understood, so they
 * fail loudly rather than falling through to node validation and producing
 * a confusing downstream error. Versions below zero aren't just invalid,
 * they're dangerous: the migration walk in `parsePreset` counts up from the
 * saved version to `PRESET_VERSION` one step at a time, so a very negative
 * version would spin through billions of no-op loop iterations before ever
 * reaching the array-shape check that would otherwise catch it. Zero stays
 * valid -- it's the version below this format's first shape, which is what
 * the migration-walk test exercises.
 */
function assertValidVersion(version: unknown): asserts version is number {
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new PresetError(`Preset version must be an integer (got ${JSON.stringify(version)}).`);
  }

  if (version > PRESET_VERSION) {
    throw new PresetError(
      `This preset needs a newer editor (preset version ${version}, editor supports ${PRESET_VERSION}).`,
    );
  }

  if (version < 0) {
    throw new PresetError(`Preset version must not be negative (got ${version}).`);
  }
}

/** Type guard for a registry spec id -- used to narrow a saved node's `spec`
    string down to `SpecId` without asserting past what's actually checked. */
function isSpecId(value: string): value is SpecId {
  return value in NODE_SPECS;
}

/**
 * Validates one node: its spec must exist in the registry (an unknown spec
 * means the preset came from a newer editor and there's no safe default to
 * fall back to, so this throws rather than dropping the node), and its
 * params are coerced onto that spec's param list.
 */
function validateNode(raw: unknown, index: number): PresetNode {
  if (!isRecord(raw)) {
    throw new PresetError(`Node at index ${index} must be an object.`);
  }

  const { id, spec, position, params } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    throw new PresetError(`Node at index ${index} is missing a string "id".`);
  }

  if (typeof spec !== 'string' || !isSpecId(spec)) {
    throw new PresetError(
      `Unknown node type "${String(spec)}" — this preset may come from a newer editor.`,
    );
  }

  return {
    id,
    spec,
    position: validatePosition(position),
    params: validateParams(spec, params),
  };
}

/** Coerces a node's saved position to finite numbers, defaulting to the origin. */
function validatePosition(raw: unknown): { x: number; y: number } {
  if (!isRecord(raw)) {
    return { x: 0, y: 0 };
  }

  return { x: finiteNumberOr(raw.x, 0), y: finiteNumberOr(raw.y, 0) };
}

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Rebuilds a node's params from its spec's declared param list, in that
 * list's order -- this is what keeps `serializePreset` output canonical
 * regardless of the order params happened to appear in on disk. Every param
 * id gets a value: a well-formed saved value passes through (clamped for
 * sliders, checked against `options` for selects, shape-checked for ramps),
 * anything missing or malformed falls back to the spec default, and any
 * saved id the spec doesn't declare is dropped.
 */
function validateParams(spec: SpecId, raw: unknown): Record<string, ParamValue> {
  const savedParams: Record<string, unknown> = isRecord(raw) ? raw : {};

  return Object.fromEntries(
    NODE_SPECS[spec].params.map((paramSpec) => [
      paramSpec.id,
      validateParamValue(paramSpec, savedParams[paramSpec.id]),
    ]),
  );
}

function validateParamValue(paramSpec: ParamSpec, value: unknown): ParamValue {
  if (paramSpec.kind === 'slider') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return paramSpec.defaultValue;
    }

    return Math.min(paramSpec.max, Math.max(paramSpec.min, value));
  }

  if (paramSpec.kind === 'select') {
    if (typeof value === 'string' && paramSpec.options.includes(value)) {
      return value;
    }

    return paramSpec.defaultValue;
  }

  return validateRamp(value, paramSpec.defaultValue);
}

/**
 * A ramp param must be an array of 2-8 `{ color, position }` stops or the
 * whole param resets to the spec default -- there's no safe way to patch a
 * ramp missing a stop's color, so this doesn't try to fix individual
 * entries. A well-formed ramp keeps its stops but clamps each position into
 * 0..1, since a stop past either end of the ramp is just a mispositioned
 * stop, not a broken one.
 */
function validateRamp(value: unknown, fallback: ColorStop[]): ColorStop[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
    return structuredClone(fallback);
  }

  const stops: ColorStop[] = [];

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.color !== 'string' ||
      typeof entry.position !== 'number' ||
      !Number.isFinite(entry.position)
    ) {
      return structuredClone(fallback);
    }

    // The color has to survive the engine's own decoder: anything it rejects
    // here would otherwise throw much later — in pushPresetToStore or the
    // compiler — past the point where a PresetError toast could catch it.
    try {
      parseColorString(entry.color);
    } catch {
      return structuredClone(fallback);
    }

    stops.push({ color: entry.color, position: Math.min(1, Math.max(0, entry.position)) });
  }

  return stops;
}

/**
 * Validates every edge against the now-validated node set: both endpoints
 * must reference a node that exists, and `targetHandle` must be one of the
 * target node's declared inputs. Unlike params, there's no safe coercion for
 * a dangling wire -- it either connects two real ports or it's dropped data,
 * so a bad edge throws instead of being silently discarded.
 */
function validateEdges(raw: unknown[], nodesById: Map<string, PresetNode>): PresetEdge[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new PresetError(`Edge at index ${index} must be an object.`);
    }

    const { source, target, targetHandle } = entry;

    if (
      typeof source !== 'string' ||
      typeof target !== 'string' ||
      typeof targetHandle !== 'string'
    ) {
      throw new PresetError(
        `Edge at index ${index} is missing a "source", "target", or "targetHandle" string.`,
      );
    }

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
