/**
 * Generate LocalLink Economist Volume 02 (February 2026) PDF from HTML design.
 * Requires: backend/scripts/economist-volume-02-design.html
 * Output: frontend/public/economist-volume-02.pdf, frontend/public/economist-volume-02-cover.png
 *
 * Run from repo root: node backend/scripts/generate-economist-volume-02-pdf-from-html.js
 *
 * Add Ghana/construction images to backend/scripts/economist-assets/ for best results:
 *   cover-vol02.png, back-cover-vol02.png, part1-vol02.png, part2-vol02.png, part3-vol02.png, part4-vol02.png
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ECONOMIST_ASSETS = path.resolve(__dirname, 'economist-assets')
const DESIGN_HTML_PATH = path.resolve(__dirname, 'economist-volume-02-design.html')
const OUT_PDF_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-02.pdf')
const OUT_COVER_PNG_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-02-cover.png')

const ASSET_BASES = ['cover-vol02', 'back-cover-vol02', 'part1-vol02', 'part2-vol02', 'part3-vol02', 'part4-vol02', 'page56-57-construction']
const PLACEHOLDERS = ['COVER_IMAGE_FILE_URL', 'BACK_COVER_IMAGE_FILE_URL', 'PART1_IMAGE_FILE_URL', 'PART2_IMAGE_FILE_URL', 'PART3_IMAGE_FILE_URL', 'PART4_IMAGE_FILE_URL', 'PAGE56_57_IMAGE_FILE_URL']

function findImagePath(base) {
  const png = path.resolve(ECONOMIST_ASSETS, `${base}.png`)
  const jpg = path.resolve(ECONOMIST_ASSETS, `${base}.jpg`)
  return fs.existsSync(png) ? png : fs.existsSync(jpg) ? jpg : null
}

function toDataUrl(buf, filenameOrMime) {
  const base64 = buf.toString('base64')
  const mime = typeof filenameOrMime === 'string' && filenameOrMime.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const PRINT_CSS = `
html, body { margin: 0; padding: 0; overflow: visible; box-sizing: border-box; }
@media print {
  @page { size: 794px 1123px; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page, .p-sep { page-break-after: always; }
  #back-cover { page-break-after: auto; }
}
`

async function main() {
  if (!fs.existsSync(DESIGN_HTML_PATH)) {
    console.error('Missing design file:', DESIGN_HTML_PATH)
    process.exit(1)
  }

  let html = fs.readFileSync(DESIGN_HTML_PATH, 'utf8')

  let coverImageUrl = TRANSPARENT_PIXEL
  const coverPath = findImagePath('cover-vol02')
  if (coverPath) {
    coverImageUrl = toDataUrl(fs.readFileSync(coverPath), path.basename(coverPath))
    console.log('Using cover image:', coverPath)
  } else {
    console.warn('Add cover-vol02.png (or .jpg) to economist-assets for Construction & Infrastructure cover')
  }
  html = html.replace(/\{\{COVER_IMAGE_FILE_URL\}\}/g, coverImageUrl)

  let backCoverImageUrl = coverImageUrl
  const backPath = findImagePath('back-cover-vol02')
  if (backPath) {
    backCoverImageUrl = toDataUrl(fs.readFileSync(backPath), path.basename(backPath))
    console.log('Using back cover image:', backPath)
  } else {
    console.log('Using cover image for back cover (add back-cover-vol02.png for dedicated back image)')
  }
  html = html.replace(/\{\{BACK_COVER_IMAGE_FILE_URL\}\}/g, backCoverImageUrl)

  const tocThumbPath = findImagePath('toc-thumb')
  let tocThumbUrl = 'https://picsum.photos/seed/cover-const/78/106'
  if (tocThumbPath) {
    tocThumbUrl = toDataUrl(fs.readFileSync(tocThumbPath), path.basename(tocThumbPath))
    console.log('Using TOC_THUMB_IMAGE:', tocThumbPath)
  }
  html = html.replace(/\{\{TOC_THUMB_IMAGE_FILE_URL\}\}/g, tocThumbUrl)

  for (let i = 0; i < 4; i++) {
    const partKey = `PART${i + 1}_IMAGE_FILE_URL`
    const partPath = findImagePath(ASSET_BASES[i + 2])
    let partUrl = TRANSPARENT_PIXEL
    if (partPath) {
      partUrl = toDataUrl(fs.readFileSync(partPath), path.basename(partPath))
      console.log('Using', partKey.replace('_FILE_URL', ''), ':', partPath)
    }
    html = html.replace(new RegExp(`\\{\\{${partKey}\\}\\}`, 'g'), partUrl)
  }

  const page5657Path = findImagePath('page56-57-construction')
  let page5657Url = TRANSPARENT_PIXEL
  if (page5657Path) {
    page5657Url = toDataUrl(fs.readFileSync(page5657Path), path.basename(page5657Path))
    console.log('Using PAGE56_57_IMAGE:', page5657Path)
  }
  html = html.replace(/\{\{PAGE56_57_IMAGE_FILE_URL\}\}/g, page5657Url)

  const tamaleRegionPath = findImagePath('tamale-region')
  let tamaleRegionUrl = TRANSPARENT_PIXEL
  if (tamaleRegionPath) {
    tamaleRegionUrl = toDataUrl(fs.readFileSync(tamaleRegionPath), path.basename(tamaleRegionPath))
    console.log('Using TAMALE_REGION_IMAGE:', tamaleRegionPath)
  }
  html = html.replace(/\{\{TAMALE_REGION_IMAGE_FILE_URL\}\}/g, tamaleRegionUrl)

  const takoradiRegionPath = findImagePath('takoradi-region')
  let takoradiRegionUrl = TRANSPARENT_PIXEL
  if (takoradiRegionPath) {
    takoradiRegionUrl = toDataUrl(fs.readFileSync(takoradiRegionPath), path.basename(takoradiRegionPath))
    console.log('Using TAKORADI_REGION_IMAGE:', takoradiRegionPath)
  }
  html = html.replace(/\{\{TAKORADI_REGION_IMAGE_FILE_URL\}\}/g, takoradiRegionUrl)

  const kumasiRegionPath = findImagePath('kumasi-region')
  let kumasiRegionUrl = TRANSPARENT_PIXEL
  if (kumasiRegionPath) {
    kumasiRegionUrl = toDataUrl(fs.readFileSync(kumasiRegionPath), path.basename(kumasiRegionPath))
    console.log('Using KUMASI_REGION_IMAGE:', kumasiRegionPath)
  }
  html = html.replace(/\{\{KUMASI_REGION_IMAGE_FILE_URL\}\}/g, kumasiRegionUrl)

  const bolgatangaRegionPath = findImagePath('bolgatanga-region')
  let bolgatangaRegionUrl = TRANSPARENT_PIXEL
  if (bolgatangaRegionPath) {
    bolgatangaRegionUrl = toDataUrl(fs.readFileSync(bolgatangaRegionPath), path.basename(bolgatangaRegionPath))
    console.log('Using BOLGATANGA_REGION_IMAGE:', bolgatangaRegionPath)
  }
  html = html.replace(/\{\{BOLGATANGA_REGION_IMAGE_FILE_URL\}\}/g, bolgatangaRegionUrl)

  const supplyChainBgPath = findImagePath('supply-chain-background')
  let supplyChainBgUrl = TRANSPARENT_PIXEL
  if (supplyChainBgPath) {
    supplyChainBgUrl = toDataUrl(fs.readFileSync(supplyChainBgPath), path.basename(supplyChainBgPath))
    console.log('Using SUPPLY_CHAIN_BG_IMAGE:', supplyChainBgPath)
  }
  html = html.replace(/\{\{SUPPLY_CHAIN_BG_IMAGE_FILE_URL\}\}/g, supplyChainBgUrl)

  const page78HighrisePath = findImagePath('page78-highrise-cantonments')
  let page78HighriseUrl = 'https://picsum.photos/seed/scaffold-gh/380/393'
  if (page78HighrisePath) {
    page78HighriseUrl = toDataUrl(fs.readFileSync(page78HighrisePath), path.basename(page78HighrisePath))
    console.log('Using PAGE78_HIGHRISE_IMAGE:', page78HighrisePath)
  }
  html = html.replace(/\{\{PAGE78_HIGHRISE_IMAGE_FILE_URL\}\}/g, page78HighriseUrl)

  const page78TemaPath = findImagePath('page78-tema-wholesaler')
  let page78TemaUrl = 'https://picsum.photos/seed/cement-stack/334/200'
  if (page78TemaPath) {
    page78TemaUrl = toDataUrl(fs.readFileSync(page78TemaPath), path.basename(page78TemaPath))
    console.log('Using PAGE78_TEMA_WHOLESALER_IMAGE:', page78TemaPath)
  }
  html = html.replace(/\{\{PAGE78_TEMA_WHOLESALER_IMAGE_FILE_URL\}\}/g, page78TemaUrl)

  const page78RebarPath = findImagePath('page78-rebar-spintex')
  let page78RebarUrl = 'https://picsum.photos/seed/rebar-yard/334/190'
  if (page78RebarPath) {
    page78RebarUrl = toDataUrl(fs.readFileSync(page78RebarPath), path.basename(page78RebarPath))
    console.log('Using PAGE78_REBAR_SPINTEX_IMAGE:', page78RebarPath)
  }
  html = html.replace(/\{\{PAGE78_REBAR_SPINTEX_IMAGE_FILE_URL\}\}/g, page78RebarUrl)

  const greenBuildingBgPath = findImagePath('green-building-background')
  let greenBuildingBgUrl = TRANSPARENT_PIXEL
  if (greenBuildingBgPath) {
    greenBuildingBgUrl = toDataUrl(fs.readFileSync(greenBuildingBgPath), path.basename(greenBuildingBgPath))
    console.log('Using GREEN_BUILDING_BG_IMAGE:', greenBuildingBgPath)
  }
  html = html.replace(/\{\{GREEN_BUILDING_BG_IMAGE_FILE_URL\}\}/g, greenBuildingBgUrl)

  const backCoverThumb1Path = findImagePath('back-cover-thumb-1')
  let backCoverThumb1Url = 'https://picsum.photos/seed/bc-const1/240/175'
  if (backCoverThumb1Path) {
    backCoverThumb1Url = toDataUrl(fs.readFileSync(backCoverThumb1Path), path.basename(backCoverThumb1Path))
    console.log('Using BACK_COVER_THUMB_1:', backCoverThumb1Path)
  }
  html = html.replace(/\{\{BACK_COVER_THUMB_1_FILE_URL\}\}/g, backCoverThumb1Url)

  const backCoverThumb2Path = findImagePath('back-cover-thumb-2')
  let backCoverThumb2Url = 'https://picsum.photos/seed/bc-const2/240/175'
  if (backCoverThumb2Path) {
    backCoverThumb2Url = toDataUrl(fs.readFileSync(backCoverThumb2Path), path.basename(backCoverThumb2Path))
    console.log('Using BACK_COVER_THUMB_2:', backCoverThumb2Path)
  }
  html = html.replace(/\{\{BACK_COVER_THUMB_2_FILE_URL\}\}/g, backCoverThumb2Url)

  const backCoverThumb3Path = findImagePath('back-cover-thumb-3')
  let backCoverThumb3Url = 'https://picsum.photos/seed/bc-const3/240/175'
  if (backCoverThumb3Path) {
    backCoverThumb3Url = toDataUrl(fs.readFileSync(backCoverThumb3Path), path.basename(backCoverThumb3Path))
    console.log('Using BACK_COVER_THUMB_3:', backCoverThumb3Path)
  }
  html = html.replace(/\{\{BACK_COVER_THUMB_3_FILE_URL\}\}/g, backCoverThumb3Url)

  html = html.replace('</head>', `<style>${PRINT_CSS}</style></head>`)

  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 })
    await page.emulateMediaType('print')

    // Wait for web fonts (Google Fonts) to load so text is not blank in the PDF
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((_, reject) => setTimeout(() => reject(new Error('fonts.ready timeout')), 15000)),
    ]).catch((err) => console.warn('Font wait:', err.message))
    // Wait for images to finish loading (picsum and data URLs)
    await Promise.race([
      page.evaluate(() =>
        Promise.all(
          Array.from(document.images).map((img) =>
            img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r })
          )
        )
      ),
      new Promise((r) => setTimeout(r, 20000)),
    ]).catch(() => {})
    // Allow layout and paint to settle
    await new Promise((r) => setTimeout(r, 3000))

    const dir = path.dirname(OUT_PDF_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    await page.pdf({
      path: OUT_PDF_PATH,
      width: '794px',
      height: '1123px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    })
    console.log('Written:', OUT_PDF_PATH)

    await page.screenshot({
      path: OUT_COVER_PNG_PATH,
      clip: { x: 0, y: 0, width: 794, height: 1123 },
      type: 'png',
    })
    console.log('Written:', OUT_COVER_PNG_PATH)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
