/**
 * Generate LocalLink Economist Volume 03 (March 2026) PDF from HTML design.
 * Requires: backend/scripts/economist-volume-03-design.html
 * Output: frontend/public/economist-volume-03.pdf, frontend/public/economist-volume-03-cover.png
 *
 * Run from repo root: node backend/scripts/generate-economist-volume-03-pdf-from-html.js
 *
 * Vol 03 design uses picsum.photos URLs for images; add assets to economist-assets/ to override later if desired.
 *
 * Layout: Print CSS forces each .page to height 1123px so one HTML page = one PDF page. Content areas
 * use min-height:0 and overflow:hidden so excess content is clipped rather than flowing into the next
 * page. If a page clips important content, split that content into an additional <div class="page"> in
 * the design HTML.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const DESIGN_HTML_PATH = path.resolve(__dirname, 'economist-volume-03-design.html')
const COVER_IMAGE_PATH = path.resolve(__dirname, 'economist-assets/vol03-cover-woman.png')
const OUT_PDF_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-03.pdf')
const OUT_COVER_PNG_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-03-cover.png')

const PRINT_CSS = `
html, body { margin: 0; padding: 0; overflow: visible; box-sizing: border-box; }
@media print {
  @page { size: 794px 1123px; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page, .p-sep { page-break-after: always; }
  #back-cover { page-break-after: auto; }
  /* Lock each .page to exactly one PDF page so content does not flow into the next */
  .page {
    height: 1123px !important;
    min-height: 0 !important;
    max-height: 1123px !important;
    overflow: hidden !important;
  }
  /* Let flex content areas shrink and clip instead of growing the page */
  .page .data-page,
  .page .profile-grid,
  .page .pol-layout,
  .page .mast-layout,
  .page .ed-grid,
  .page .portrait-page,
  .page .photo-mosaic,
  .page .region-grid,
  .page .itv-body,
  .page .op-body,
  .page .bc-body,
  .page .two-col,
  .page .three-col,
  .page [style*="flex:1"] {
    min-height: 0 !important;
    overflow: hidden !important;
  }
}
`

async function main() {
  if (!fs.existsSync(DESIGN_HTML_PATH)) {
    console.error('Missing design file:', DESIGN_HTML_PATH)
    process.exit(1)
  }

  let html = fs.readFileSync(DESIGN_HTML_PATH, 'utf8')
  if (fs.existsSync(COVER_IMAGE_PATH)) {
    const coverBuf = fs.readFileSync(COVER_IMAGE_PATH)
    const coverDataUrl = `data:image/png;base64,${coverBuf.toString('base64')}`
    html = html.replace('REPLACE_COVER_IMAGE_DATA_URL', coverDataUrl)
  } else {
    html = html.replace('REPLACE_COVER_IMAGE_DATA_URL', 'https://picsum.photos/seed/women-trades-ghana/794/1123')
  }
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
    // Use 'screen' to avoid print color shift (e.g. gradient → pink in some PDF viewers)
    await page.emulateMediaType('screen')

    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((_, reject) => setTimeout(() => reject(new Error('fonts.ready timeout')), 15000)),
    ]).catch((err) => console.warn('Font wait:', err.message))
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
