// Turns an exported Blender node graph into one TSL color node. It walks
// upstream from the tapped socket, opens node groups as it meets them, and
// builds each node from the TSL ports in ../nodes. A node that no path from
// the tap reaches is never built, so the lighting half of a material costs
// nothing.
import { float, Fn, mix, positionLocal, vec3, vec4 } from 'three/tsl';

import {
  brightContrast,
  gamma,
  hueSaturationValue,
  mixColor,
  rgbToBw,
  rgbToHsv,
} from '../nodes/color';
import type { TSLNode } from '../nodes/gpu-function';
import { clampNode, mapRange, mathNode, vectorMath, vectorRotate } from '../nodes/math';
import { noiseTexture3D } from '../nodes/noise';
import { voronoiDistanceToEdge3D } from '../nodes/voronoi';
import { waveTexture } from '../nodes/wave';
import type { TapPath } from './tap';
import type { GraphNode, GraphSocket, GraphTree, MaterialGraph, SocketDefault } from './types';

// ----------------------------------------------------------------------------
// Values and Blender's implicit conversions
// ----------------------------------------------------------------------------

type Kind = 'float' | 'vec3' | 'vec4';

interface SocketValue {
  kind: Kind;
  node: TSLNode;
  // The number behind a float that no shader math produced: an unlinked
  // socket, or a group input passed straight through. Loop counts such as
  // a texture's Detail have to be numbers when the shader is built.
  constant?: number;
}

function kindOf(socketType: string): Kind {
  switch (socketType) {
    case 'VALUE':
    case 'INT':
    case 'BOOLEAN':
      return 'float';
    case 'VECTOR':
      return 'vec3';
    case 'RGBA':
      return 'vec4';
    default:
      throw new Error(`Socket type ${socketType} has no shader value`);
  }
}

// Blender converts a link's value to the type of the socket it plugs into,
// with the rules in gpu_shader_codegen_lib.glsl: a color becomes its
// luminance, a vector the mean of its components, and a float fills every
// component, with alpha 1.
function convert(value: SocketValue, to: Kind): SocketValue {
  if (value.kind === to) return value;

  const { node } = value;

  switch (`${value.kind}>${to}`) {
    case 'vec4>float':
      return { kind: to, node: rgbToBw(node) };
    case 'vec3>float':
      return {
        kind: to,
        node: node.x
          .add(node.y)
          .add(node.z)
          .mul(1 / 3),
      };
    case 'float>vec3':
      return { kind: to, node: vec3(node) };
    case 'float>vec4':
      return { kind: to, node: vec4(vec3(node), 1) };
    case 'vec4>vec3':
      return { kind: to, node: node.rgb };
    default:
      return { kind: to, node: vec4(node, 1) };
  }
}

function defaultValue(socket: GraphSocket): SocketValue {
  const kind = kindOf(socket.type);
  const value: SocketDefault = socket.default ?? 0;

  if (kind === 'float') {
    const number = typeof value === 'number' ? value : Number(value);

    return { kind, node: float(number), constant: number };
  }
  if (!Array.isArray(value)) throw new Error(`Socket ${socket.name} has no vector default`);

  return kind === 'vec3'
    ? { kind, node: vec3(value[0], value[1], value[2]) }
    : { kind, node: vec4(value[0], value[1], value[2], value[3]) };
}

// ----------------------------------------------------------------------------
// Frames: one per open node group
// ----------------------------------------------------------------------------
// The same group can sit in a material twice with different inputs, so every
// open group gets a frame keyed by its path from the material's tree.

interface Frame {
  key: string;
  tree: GraphTree;
  parent?: { frame: Frame; groupNode: GraphNode };
}

interface NodeContext {
  node: GraphNode;
  // An input socket's value, converted to the socket's own type.
  input: (id: string) => SocketValue;
  // A texture's Vector input. Unlinked, Blender fills it with Generated
  // coordinates, which the probe's plane doesn't have, so that throws.
  vector: () => TSLNode;
  // A node setting, such as a Math node's operation.
  option: (name: string) => string;
  flag: (name: string) => boolean;
}

type NodeOutputs = Record<string, TSLNode>;
type NodeBuilder = (context: NodeContext) => NodeOutputs;

class GraphEvaluator {
  private readonly graph: MaterialGraph;
  private readonly cache = new Map<string, SocketValue>();
  // Every output a node builds, so a texture with two linked outputs runs
  // its noise once.
  private readonly nodeOutputs = new Map<string, NodeOutputs>();

  constructor(graph: MaterialGraph) {
    // The luma weights in nodes/color.ts are Rec.709's.
    if (graph.workingSpace !== 'Linear Rec.709') {
      throw new Error(`Working space ${graph.workingSpace} is not ported`);
    }
    this.graph = graph;
  }

  /** The Base Color input the export tapped, as a vec3 in scene-linear sRGB. */
  evaluateBaseColor(): TSLNode {
    const frame = this.openPath(this.graph.tap.groupPath);
    const tapNode = findNode(frame.tree, this.graph.tap.node);
    const socket = findSocket(tapNode.inputs, this.graph.tap.socket);

    return convert(this.input(frame, tapNode, socket.id), 'vec3').node;
  }

  /** One node's output, converted to a color the way an Emission input would. */
  evaluateOutput(tap: TapPath): TSLNode {
    const frame = this.openPath(tap.groupPath);
    const node = findNode(frame.tree, tap.node);
    const socket = findSocket(node.outputs, tap.output);

    return convert(this.output(frame, node.name, socket.id), 'vec3').node;
  }

  private openPath(groupPath: string[]): Frame {
    let frame: Frame = { key: 'root', tree: this.graph.root };

    for (const groupName of groupPath) {
      frame = this.openGroup(frame, findNode(frame.tree, groupName));
    }

    return frame;
  }

  private openGroup(frame: Frame, groupNode: GraphNode): Frame {
    const groupName = groupNode.props.group;

    if (typeof groupName !== 'string') throw new Error(`Group node ${groupNode.name} has no tree`);

    const tree = this.graph.groups[groupName];

    if (!tree) throw new Error(`Group ${groupName} was not exported`);

    return { key: `${frame.key}>${groupNode.name}`, tree, parent: { frame, groupNode } };
  }

  // The value arriving at a node's input socket.
  private input(frame: Frame, node: GraphNode, socketId: string): SocketValue {
    const socket = node.inputs.find((s) => s.id === socketId);

    if (!socket) throw new Error(`${node.name} has no input ${socketId}`);

    const link = frame.tree.links.find((l) => l.to === node.name && l.toSocket === socketId);

    if (!link) return defaultValue(socket);

    return convert(this.output(frame, link.from, link.fromSocket), kindOf(socket.type));
  }

  // The value a node puts on one output socket, built once per frame.
  private output(frame: Frame, nodeName: string, socketId: string): SocketValue {
    const key = `${frame.key}/${nodeName}/${socketId}`;
    const cached = this.cache.get(key);

    if (cached) return cached;

    const value = this.buildOutput(frame, findNode(frame.tree, nodeName), socketId);

    this.cache.set(key, value);

    return value;
  }

  private buildOutput(frame: Frame, node: GraphNode, socketId: string): SocketValue {
    if (node.mute) throw new Error(`Muted node ${node.name} is not supported`);

    switch (node.type) {
      case 'ShaderNodeGroup': {
        const inner = this.openGroup(frame, node);
        const groupOutput = inner.tree.nodes.find(
          (n) => n.type === 'NodeGroupOutput' && n.props.is_active_output !== false,
        );

        if (!groupOutput) throw new Error(`Group ${node.name} has no output node`);

        return this.input(inner, groupOutput, socketId);
      }
      case 'NodeGroupInput': {
        // Inside a group, its inputs are the group node's inputs outside.
        if (!frame.parent) throw new Error('A group input outside any group');

        return this.input(frame.parent.frame, frame.parent.groupNode, socketId);
      }
      case 'NodeReroute':
        return this.input(frame, node, 'Input');
      default:
        return this.buildShaderNode(frame, node, socketId);
    }
  }

  private textureVector(frame: Frame, node: GraphNode): TSLNode {
    const linked = frame.tree.links.some((l) => l.to === node.name && l.toSocket === 'Vector');

    if (!linked) {
      throw new Error(`${node.name}'s unlinked Vector (Generated coordinates) is not ported`);
    }

    return this.input(frame, node, 'Vector').node;
  }

  private buildShaderNode(frame: Frame, node: GraphNode, socketId: string): SocketValue {
    const builder = NODE_BUILDERS[node.type];

    if (!builder) throw new Error(`Node type ${node.type} (${node.name}) is not ported`);

    const socket = node.outputs.find((s) => s.id === socketId);

    if (!socket) throw new Error(`${node.name} has no output ${socketId}`);

    const key = `${frame.key}/${node.name}`;
    const outputs =
      this.nodeOutputs.get(key) ??
      builder({
        node,
        input: (id) => this.input(frame, node, id),
        vector: () => this.textureVector(frame, node),
        option: (name) => optionSetting(node, name),
        flag: (name) => flagSetting(node, name),
      });

    this.nodeOutputs.set(key, outputs);

    const result = outputs[socketId];

    if (!result) throw new Error(`${node.type} output ${socketId} is not ported`);

    return { kind: kindOf(socket.type), node: result.toVar() };
  }
}

function optionSetting(node: GraphNode, name: string): string {
  const value = node.props[name];

  if (typeof value !== 'string') throw new Error(`${node.name} has no option ${name}`);

  return value;
}

function flagSetting(node: GraphNode, name: string): boolean {
  const value = node.props[name];

  if (typeof value !== 'boolean') throw new Error(`${node.name} has no on/off setting ${name}`);

  return value;
}

function findSocket(sockets: GraphSocket[], key: string): GraphSocket {
  const socket = sockets.find((s) => s.id === key || s.name === key);

  if (!socket) throw new Error(`Socket ${key} not found`);

  return socket;
}

function findNode(tree: GraphTree, name: string): GraphNode {
  const node = tree.nodes.find((n) => n.name === name);

  if (!node) throw new Error(`Node ${name} not found`);

  return node;
}

// A float input that has to be a number when the shader is built.
function constantOf(value: SocketValue, what: string): number {
  if (value.constant === undefined) throw new Error(`${what} must be a constant to port`);

  return value.constant;
}

// ----------------------------------------------------------------------------
// Node builders
// ----------------------------------------------------------------------------

const textureBuilders: Record<string, NodeBuilder> = {
  ShaderNodeTexCoord: ({ node, flag }) => {
    if (node.props.object != null || flag('from_instancer')) {
      throw new Error(`${node.name} reads another object's space, which is not ported`);
    }

    // The probe draws on a plane whose local position matches the Blender
    // reference plane's object space, -1..1 on x and y.
    return { Object: positionLocal };
  },
  ShaderNodeTexNoise: ({ input, vector, option, flag }) => {
    if (option('noise_dimensions') !== '3D' || option('noise_type') !== 'FBM') {
      throw new Error('Only 3D fBM noise is ported');
    }

    const { fac, color } = noiseTexture3D({
      vector: vector(),
      scale: input('Scale').node,
      detail: constantOf(input('Detail'), 'Noise detail'),
      roughness: input('Roughness').node,
      lacunarity: input('Lacunarity').node,
      distortion: input('Distortion').node,
      distortionIsZero: input('Distortion').constant === 0,
      normalize: flag('normalize'),
    });

    return { Fac: fac, Color: color };
  },
  ShaderNodeTexVoronoi: ({ input, vector, option, flag }) => {
    if (option('voronoi_dimensions') !== '3D' || option('feature') !== 'DISTANCE_TO_EDGE') {
      throw new Error('Only 3D Distance to Edge Voronoi is ported');
    }

    return {
      Distance: voronoiDistanceToEdge3D({
        vector: vector(),
        scale: input('Scale').node,
        detail: constantOf(input('Detail'), 'Voronoi detail'),
        roughness: input('Roughness').node,
        lacunarity: input('Lacunarity').node,
        randomness: input('Randomness').node,
        roughnessIsZero: input('Roughness').constant === 0,
        normalize: flag('normalize'),
      }),
    };
  },
  ShaderNodeTexWave: ({ input, vector, option }) => {
    const { fac, color } = waveTexture({
      vector: vector(),
      scale: input('Scale').node,
      distortion: input('Distortion').node,
      distortionIsZero: input('Distortion').constant === 0,
      detail: constantOf(input('Detail'), 'Wave detail'),
      detailScale: input('Detail Scale').node,
      detailRoughness: input('Detail Roughness').node,
      phase: input('Phase Offset').node,
      waveType: option('wave_type'),
      bandsDirection: option('bands_direction'),
      ringsDirection: option('rings_direction'),
      profile: option('wave_profile'),
    });

    return { Fac: fac, Color: color };
  },
};

const mathBuilders: Record<string, NodeBuilder> = {
  ShaderNodeMath: ({ input, option, flag }) => ({
    Value: mathNode(
      option('operation'),
      input('Value').node,
      input('Value_001').node,
      input('Value_002').node,
      flag('use_clamp'),
    ),
  }),
  ShaderNodeMapRange: ({ input, option, flag }) => {
    if (option('data_type') !== 'FLOAT') throw new Error('Only float Map Range is ported');

    return {
      Result: mapRange(
        option('interpolation_type'),
        {
          value: input('Value').node,
          fromMin: input('From Min').node,
          fromMax: input('From Max').node,
          toMin: input('To Min').node,
          toMax: input('To Max').node,
          steps: input('Steps').node,
        },
        flag('clamp'),
      ),
    };
  },
  ShaderNodeClamp: ({ input, option }) => ({
    Result: clampNode(
      option('clamp_type'),
      input('Value').node,
      input('Min').node,
      input('Max').node,
    ),
  }),
  ShaderNodeVectorMath: ({ input, option }) => {
    const { vector, value } = vectorMath(
      option('operation'),
      input('Vector').node,
      input('Vector_001').node,
      input('Vector_002').node,
      input('Scale').node,
    );

    return { Vector: vector, Value: value };
  },
  ShaderNodeVectorRotate: ({ input, option, flag }) => ({
    Vector: vectorRotate(
      option('rotation_type'),
      input('Vector').node,
      input('Center').node,
      input('Axis').node,
      input('Angle').node,
      flag('invert'),
    ),
  }),
  ShaderNodeSeparateXYZ: ({ input }) => {
    const vector = input('Vector').node;

    return { X: vector.x, Y: vector.y, Z: vector.z };
  },
  ShaderNodeCombineXYZ: ({ input }) => ({
    Vector: vec3(input('X').node, input('Y').node, input('Z').node),
  }),
};

const colorBuilders: Record<string, NodeBuilder> = {
  ShaderNodeMix: ({ input, option, flag }): NodeOutputs => {
    const dataType = option('data_type');
    const clampFactor = flag('clamp_factor');
    const factor = input('Factor_Float').node;
    const clampedFactor = clampFactor ? factor.clamp(0, 1) : factor;

    if (dataType === 'RGBA') {
      return {
        Result_Color: mixColor(
          option('blend_type'),
          factor,
          input('A_Color').node,
          input('B_Color').node,
          clampFactor,
          flag('clamp_result'),
        ),
      };
    }
    if (dataType === 'FLOAT') {
      return { Result_Float: mix(input('A_Float').node, input('B_Float').node, clampedFactor) };
    }
    if (option('factor_mode') !== 'UNIFORM')
      throw new Error('Non-uniform vector Mix is not ported');

    return { Result_Vector: mix(input('A_Vector').node, input('B_Vector').node, clampedFactor) };
  },
  ShaderNodeHueSaturation: ({ input }) => ({
    Color: hueSaturationValue(
      input('Color').node,
      input('Hue').node,
      input('Saturation').node,
      input('Value').node,
      input('Fac').node,
    ),
  }),
  ShaderNodeGamma: ({ input }) => ({ Color: gamma(input('Color').node, input('Gamma').node) }),
  ShaderNodeBrightContrast: ({ input }) => ({
    Color: brightContrast(input('Color').node, input('Bright').node, input('Contrast').node),
  }),
  ShaderNodeRGBToBW: ({ input }) => ({ Val: rgbToBw(input('Color').node) }),
  ShaderNodeSeparateColor: ({ input, option }) => {
    const color = input('Color').node;
    const mode = option('mode');

    if (mode === 'RGB') return { Red: color.r, Green: color.g, Blue: color.b };
    if (mode !== 'HSV') throw new Error(`Separate Color mode ${mode} is not ported`);

    const hsv = rgbToHsv(color);

    return { Red: hsv.x, Green: hsv.y, Blue: hsv.z };
  },
  ShaderNodeInvert: ({ input }) => {
    const color = input('Color').node;

    return { Color: vec4(mix(color.rgb, vec3(1).sub(color.rgb), input('Fac').node), color.a) };
  },
  ShaderNodeValue: ({ node }) => ({ Value: float(Number(node.outputs[0]?.default ?? 0)) }),
};

const NODE_BUILDERS: Record<string, NodeBuilder> = {
  ...textureBuilders,
  ...mathBuilders,
  ...colorBuilders,
};

/**
 * Build the material's Base Color, or the output a tap names, as a TSL
 * node. Runs inside an inline Fn so the ports' .toVar() and loops have a
 * statement list to write to.
 */
export function buildMaterialColor(graph: MaterialGraph, tap: TapPath | null): TSLNode {
  return Fn(() => {
    const evaluator = new GraphEvaluator(graph);

    return tap ? evaluator.evaluateOutput(tap) : evaluator.evaluateBaseColor();
  })();
}
