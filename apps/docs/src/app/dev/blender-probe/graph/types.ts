// The JSON shape blender/export_material.py writes: a material's node tree
// and every node group it reaches, close to how Blender's Python API sees
// them. Sockets and links use Blender's socket identifiers, which stay
// unique within a node where display names can repeat.

export type SocketDefault = number | boolean | string | number[] | null;

export interface GraphSocket {
  id: string;
  name: string;
  // Blender's socket type: VALUE, INT, BOOLEAN, VECTOR, RGBA, SHADER, and so on.
  type: string;
  enabled: boolean;
  default?: SocketDefault;
}

export interface GraphNode {
  name: string;
  // Blender's bl_idname, such as ShaderNodeTexNoise.
  type: string;
  mute: boolean;
  props: Record<string, unknown>;
  inputs: GraphSocket[];
  outputs: GraphSocket[];
}

export interface GraphLink {
  from: string;
  fromSocket: string;
  to: string;
  toSocket: string;
}

export interface GraphTree {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface MaterialGraph {
  blender: string;
  // The file's working color space, such as Linear Rec.709.
  workingSpace: string;
  material: string;
  // Where the reference render taps the material: the group nodes to open
  // from the material's own tree, then the node and input socket inside.
  tap: { groupPath: string[]; node: string; socket: string };
  root: GraphTree;
  groups: Record<string, GraphTree>;
}
