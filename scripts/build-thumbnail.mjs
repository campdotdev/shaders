// Cuts a component's card thumbnail from its poster, for the components index
// (apps/docs/src/app/components/page.tsx). A card shows its picture in a 62px
// square, so a full poster there would download a 2160x1440 capture to draw a
// thumbnail. build-posters.sh runs this after each capture, so a thumbnail
// always matches the poster beside it.
//
//   node scripts/build-thumbnail.mjs apps/docs/public/posters/aurora.jpg
//   node scripts/build-thumbnail.mjs apps/docs/public/posters/dot-field.png --crop 360
//
// Each writes <name>.thumb.webp beside the poster. The docs catalog
// (apps/docs/src/content/catalog.ts) builds the same path from the slug.
import { basename, dirname, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

// Output edge in pixels: the card's 62px square at a 2x device pixel ratio,
// the ratio the posters are captured at. Raising it sharpens the thumbnail
// on a 3x screen and grows every file; lowering it blurs on a 2x screen.
const SIZE = 124;

// WebP quality, 0 to 100. At 124px the artifacts of 80 are invisible, and
// the twenty thumbnails came to about 34 KB together, the busiest (Dissolve)
// near 8 KB. Raising it grows the noisy ones first.
const QUALITY = 80;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { crop: { type: 'string' } },
});
const poster = positionals[0];

if (!poster) {
  console.error('usage: node scripts/build-thumbnail.mjs <poster> [--crop <px>]');
  process.exit(1);
}

const output = join(dirname(poster), `${basename(poster, extname(poster))}.thumb.webp`);
let image = sharp(poster);

// --crop cuts a square of that many poster pixels from the center before
// scaling. It is for the pixel-sized shaders, such as DotField, whose poster
// keeps the pattern at its real on-screen size. DotField draws a 3px mark
// every 30px, which the 2x capture stores as 6 and 60 poster pixels.
// Cover-fitting its 2560px-tall poster down to 124px shrinks each mark to
// about 0.3px, and the thumbnail reads as a black square.
if (values.crop) {
  const side = Number.parseInt(values.crop, 10);
  const { width, height } = await image.metadata();

  if (!(side > 0 && side <= width && side <= height)) {
    console.error(`--crop ${values.crop} does not fit the ${width}x${height} poster ${poster}`);
    process.exit(1);
  }

  image = image.extract({
    left: Math.floor((width - side) / 2),
    top: Math.floor((height - side) / 2),
    width: side,
    height: side,
  });
}

// Cover-fitting a 3:2 poster into a square keeps its full height and cuts
// the same amount off either side, so the thumbnail is the poster's center
// square, the framing the Figma mock's cards show. After a --crop the
// source is already square and this only scales it.
await image
  .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
  .webp({ quality: QUALITY })
  .toFile(output);

console.log(`    thumbnail ${output}`);
