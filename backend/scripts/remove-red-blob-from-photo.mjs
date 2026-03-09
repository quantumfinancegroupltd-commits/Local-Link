/**
 * One-off: remove the large red blob from the bottom-right of the portrait photo
 * by overlaying the background color. Run from repo root:
 * node backend/scripts/remove-red-blob-from-photo.mjs
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Asset path under user .cursor (from repo root: ../../.. = user home)
const inputPath =
  path.resolve(__dirname, '../../../../.cursor/projects/Users-richardholland-Desktop-LocalLink/assets/PHOTO-2026-03-05-00-46-15-7ecc1366-2749-4d3b-a035-5d453be82232.png')
const outputPath = inputPath

async function main() {
  const img = sharp(inputPath)
  const meta = await img.metadata()
  const w = meta.width || 800
  const h = meta.height || 800
  // Background color (light grey) to cover the red blob
  const fill = '#e6e6e6'
  // Overlay: ellipse in bottom-right covering the red blob (from ~50% right, ~40% down to edges)
  const cx = w * 0.82
  const cy = h * 0.88
  const rx = w * 0.45
  const ry = h * 0.5
  const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>
</svg>
`
  const overlay = Buffer.from(svg)
  const out = await img
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer()
  await sharp(out).toFile(outputPath)
  console.log('Written:', outputPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
