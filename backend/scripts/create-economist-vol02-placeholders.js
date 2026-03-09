/**
 * Create placeholder images for Economist Volume 02 (Construction & Infrastructure).
 * Uses sharp to generate 794×1123 images in design palette so the PDF is never blank.
 * Run from repo root: node backend/scripts/create-economist-vol02-placeholders.js
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(__dirname, 'economist-assets')
const W = 794
const H = 1123

// Design palette (economist-volume-02-design.html)
const colors = {
  navy: { r: 11, g: 22, b: 35 },
  navyMid: { r: 18, g: 32, b: 53 },
  navyLt: { r: 28, g: 49, b: 80 },
  steel: { r: 45, g: 74, b: 107 },
}

async function solidImage(rgb, outPath) {
  const buf = await sharp({
    create: { width: W, height: H, channels: 3, background: rgb },
  })
    .png()
    .toBuffer()
  fs.writeFileSync(outPath, buf)
  console.log('Written:', path.relative(process.cwd(), outPath))
}

async function main() {
  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true })

  await solidImage(colors.navy, path.join(ASSETS, 'cover-vol02.png'))
  await solidImage(colors.navyMid, path.join(ASSETS, 'back-cover-vol02.png'))
  await solidImage(colors.navy, path.join(ASSETS, 'part1-vol02.png'))
  await solidImage(colors.navyMid, path.join(ASSETS, 'part2-vol02.png'))
  await solidImage(colors.navyLt, path.join(ASSETS, 'part3-vol02.png'))
  await solidImage(colors.steel, path.join(ASSETS, 'part4-vol02.png'))

  console.log('Done. Regenerate PDF: node backend/scripts/generate-economist-volume-02-pdf-from-html.js')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
