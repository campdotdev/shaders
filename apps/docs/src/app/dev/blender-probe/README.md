# How to compare a Blender material with its TSL port

`/dev/blender-probe` rebuilds a Blender material in TSL from its node graph and shows it beside Blender's own render. The port reproduces the color the graph feeds a Principled BSDF's Base Color. Lighting, roughness, bump, and displacement stay in Blender.

## Export the material

Run the export script on the `.blend` file, from the repo root:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
	--factory-startup --disable-autoexec path/to/file.blend \
	--python apps/docs/src/app/dev/blender-probe/blender/export_material.py -- \
	--material "Polished Jade Marble" --name green-marble \
	--out apps/docs/public/blender-probe
```

The script writes four files to `apps/docs/public/blender-probe/`:

- `green-marble.graph.json`, the node graph and every node group it reaches.
- `green-marble.reference.png`, a 1024px Cycles render of the Base Color on a 2x2 plane through the object's origin, with emission in place of the BSDF and the Standard view transform.
- `green-marble.lit.jpg`, the material on its own object, lit by the file's own light and view transform.
- `index.json`, the list of exports the probe offers.

The lit render takes a couple of minutes. To skip it, pass `--skip-lit`.

Git ignores `apps/docs/public/blender-probe/`. A material from an asset library, such as BlendKit, usually forbids redistribution, and the repo is public. Keep the `.blend` file and its exports out of commits.

## View the port

Start the dev server with `pnpm dev:docs` and open `/dev/blender-probe`. To pick an export, add `?material=<name>`. To see where the port differs, select **Difference**: matching pixels cancel to black, and **Gain** brightens what's left.

## Measure the difference

With the dev server running, capture the canvas and compare it with the reference:

```bash
node scripts/compare-blender-probe.mjs green-marble --port 3000
```

The script prints the mean and maximum error in 8-bit levels and the share of pixels within 1 and 2 levels. It writes `green-marble.tsl.png` and a 16x-brightened `green-marble.diff.png` beside the export. The scene dithers its output by half a level, so 1 level is a match. It runs WebGPU on the Mac's GPU. To test three's WebGL2 fallback, add `--webgl`.

## Find the node where a mismatch starts

To compare one node's output instead of the Base Color, tap it. A tap names the group nodes to open from the material's tree, then the node and its output socket:

```bash
# Render Blender's side of the tap.
Blender ... -- --material "Polished Jade Marble" --name green-marble \
	--out apps/docs/public/blender-probe --tap "Group/Wave Texture:Fac"

# Compare the TSL side.
node scripts/compare-blender-probe.mjs green-marble --tap "Group/Wave Texture:Fac"
```

The probe page takes the same tap as `?tap=Group/Wave%20Texture:Fac`. Start at the textures nearest the Texture Coordinate node and work downstream. The first tap that differs holds the bug.

## Know what the port covers

`graph/evaluate.ts` builds each node from the ports in `nodes/`, which follow Blender 5.2.3's GLSL line for line. A node type it has no builder for stops the build with an error that names the node. The ported set is what the green marble needed, plus the cheap neighbors of those nodes:

- Noise Texture in 3D fBM mode, Voronoi Texture in 3D Distance to Edge mode, and every Wave Texture mode.
- Most Math and Vector Math operations, Map Range in Float mode, Clamp, and Vector Rotate in its axis modes.
- Mix in Float, uniform Vector, and every Color blend mode, plus Hue/Saturation/Value, Gamma, Bright/Contrast, RGB to BW, Separate Color in RGB and HSV, and Invert.
- Separate XYZ, Combine XYZ, Value, Reroute, node groups, and the Object output of Texture Coordinate for the material's own object.

Only the modes the green marble uses have been checked against Cycles. The rest follow the GLSL but have no tap behind them yet. A texture's Detail has to be a constant, because it sets a loop count when the shader builds. A texture's Vector has to be linked: unlinked, Blender uses Generated coordinates, which the port doesn't have.

The files in `nodes/` port Blender's GPL-2.0-or-later shader code and carry that license. The rest of the repo is MIT.
