// A tap names one node output to render in place of the Base Color, the way
// export_material.py's --tap does, so a mismatch can be traced to the first
// node where Blender and the port part ways. The path names the group nodes
// to open from the material's tree, then the node and its output:
// "Group/Noise Texture:Color".

export interface TapPath {
  groupPath: string[];
  node: string;
  output: string;
}

export function parseTap(path: string): TapPath {
  const parts = path.split('/');
  const target = parts.pop() ?? '';
  const [node, output] = target.split(':');

  if (node === undefined || output === undefined || node === '' || output === '') {
    throw new Error(`Tap "${path}" needs the form Group/Node:Output`);
  }

  return { groupPath: parts, node, output };
}

/** The file-name slug for a tap, the same one export_material.py writes. */
export function tapSlug(path: string): string {
  return path
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
