/**
 * Generate LocalLink Economist Volume 01 PDF from the HTML design.
 * Requires: backend/scripts/economist-volume-01-design.html (your full magazine HTML).
 * Output: frontend/public/economist-volume-01.pdf
 *
 * Run from repo root: node backend/scripts/generate-economist-volume-01-pdf-from-html.js
 *
 * Requires: npm install puppeteer (in backend)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const DESIGN_HTML_PATH = path.resolve(__dirname, 'economist-volume-01-design.html')
const OUT_PDF_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-01.pdf')
const OUT_COVER_PNG_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-01-cover.png')
const COVER_IMAGE_BASE = 'ghana-virgyl-sowah-e9npwgbxm9o-unsplash'
const PAGE6_IMAGE_BASE = 'page6-pottery-workshop'
const PART1_IMAGE_BASE = 'part1-big-picture'
const PART2_IMAGE_BASE = 'part2-brain-drain'
const PART3_IMAGE_BASE = 'part3-tvet'
const PART4_IMAGE_BASE = 'part4-regional-spotlight'
const PART5_IMAGE_BASE = 'part5-policy'
const PAGE14_IMAGE_BASE = 'page14-feature'
const PAGE22_IMAGE_BASE = 'page22-welding'
const PAGE44_NAP_IMAGE_BASE = 'page44-nap-employer'
const PAGE44_WEAVING_IMAGE_BASE = 'page44-weaving'
const GRACE_ELECTRICIAN_IMAGE_BASE = 'grace-electrician'
const SUAME_MAGAZINE_IMAGE_BASE = 'suame-magazine'
const CECILIA_DAPAAH_IMAGE_BASE = 'cecilia-dapaah-ntim'
const PAGE70_FOREMAN_IMAGE_BASE = 'page70-foreman'
const PAGE70_WELDER_IMAGE_BASE = 'page70-welder'
const PAGE70_ARTISAN_IMAGE_BASE = 'page70-artisan'
const PAGE71_NURSE_IMAGE_BASE = 'page71-nurse'
const PAGE71_TECHNICIAN_IMAGE_BASE = 'page71-technician'
const PAGE71_NORTH_IMAGE_BASE = 'page71-north'
const BACK_COVER_IMAGE_BASE = 'back-cover'
const ECONOMIST_ASSETS = path.resolve(__dirname, 'economist-assets')
// Prefer .png then .jpg so local aerial image is used
const COVER_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${COVER_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${COVER_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE6_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE6_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE6_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PART1_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PART1_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PART1_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PART2_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PART2_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PART2_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PART3_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PART3_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PART3_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PART4_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PART4_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PART4_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PART5_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PART5_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PART5_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE14_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE14_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE14_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE22_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE22_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE22_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE44_NAP_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE44_NAP_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE44_NAP_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE44_WEAVING_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE44_WEAVING_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE44_WEAVING_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const GRACE_ELECTRICIAN_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${GRACE_ELECTRICIAN_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${GRACE_ELECTRICIAN_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const SUAME_MAGAZINE_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${SUAME_MAGAZINE_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${SUAME_MAGAZINE_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const CECILIA_DAPAAH_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${CECILIA_DAPAAH_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${CECILIA_DAPAAH_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE70_FOREMAN_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_FOREMAN_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_FOREMAN_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE70_WELDER_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_WELDER_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_WELDER_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE70_ARTISAN_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_ARTISAN_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE70_ARTISAN_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE71_NURSE_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_NURSE_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_NURSE_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE71_TECHNICIAN_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_TECHNICIAN_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_TECHNICIAN_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const PAGE71_NORTH_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_NORTH_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${PAGE71_NORTH_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
const BACK_COVER_IMAGE_PATH = [
  path.resolve(ECONOMIST_ASSETS, `${BACK_COVER_IMAGE_BASE}.png`),
  path.resolve(ECONOMIST_ASSETS, `${BACK_COVER_IMAGE_BASE}.jpg`),
].find((p) => fs.existsSync(p))
// Placeholder when no local file (mountain scene – replace with aerial image in economist-assets)
const COVER_IMAGE_FALLBACK_URL = 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1588&q=80'

function toDataUrl(buf, filenameOrMime) {
  const base64 = buf.toString('base64')
  const mime = typeof filenameOrMime === 'string' && filenameOrMime.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

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
    console.error('Create it by saving your full magazine HTML as economist-volume-01-design.html in backend/scripts/')
    process.exit(1)
  }

  let html = fs.readFileSync(DESIGN_HTML_PATH, 'utf8')
  // Inject cover image as data URL (works with setContent). Left half = page 1, right half = page 2.
  let coverImageUrl
  if (COVER_IMAGE_PATH) {
    const buf = fs.readFileSync(COVER_IMAGE_PATH)
    coverImageUrl = toDataUrl(buf, path.basename(COVER_IMAGE_PATH))
    console.log('Using cover image:', COVER_IMAGE_PATH)
  } else {
    try {
      const res = await fetch(COVER_IMAGE_FALLBACK_URL)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const isJpeg = buf.length > 100 && buf[0] === 0xff && buf[1] === 0xd8
        if (buf.length > 1000 && isJpeg) {
          coverImageUrl = toDataUrl(buf, 'image.jpg')
          console.log('Using placeholder cover image (add', COVER_IMAGE_BASE, 'to economist-assets for aerial photo)')
        } else throw new Error('Not a valid JPEG')
      } else throw new Error(res.status)
    } catch (e) {
      coverImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      console.warn('Cover image not found:', COVER_IMAGE_PATH, '-', e.message)
    }
  }
  html = html.replace(/\{\{COVER_IMAGE_FILE_URL\}\}/g, coverImageUrl)

  // Back cover: use dedicated back-cover image if present, else reuse cover image
  let backCoverImageUrl
  if (BACK_COVER_IMAGE_PATH) {
    const buf = fs.readFileSync(BACK_COVER_IMAGE_PATH)
    backCoverImageUrl = toDataUrl(buf, path.basename(BACK_COVER_IMAGE_PATH))
    console.log('Using back cover image:', BACK_COVER_IMAGE_PATH)
  } else {
    backCoverImageUrl = coverImageUrl
    console.log('Using cover image for back cover (no back-cover.png in economist-assets)')
  }
  html = html.replace(/\{\{BACK_COVER_IMAGE_FILE_URL\}\}/g, backCoverImageUrl)

  // Page 6 hero image (pottery/workshop) — same neutral treatment as cover
  let page6ImageUrl
  if (PAGE6_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE6_IMAGE_PATH)
    page6ImageUrl = toDataUrl(buf, path.basename(PAGE6_IMAGE_PATH))
    console.log('Using page 6 image:', PAGE6_IMAGE_PATH)
  } else {
    page6ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 6 image not found — add', PAGE6_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE6_IMAGE_FILE_URL\}\}/g, page6ImageUrl)

  // Part One — The Big Picture section divider (food processing / workforce photo)
  let part1ImageUrl
  if (PART1_IMAGE_PATH) {
    const buf = fs.readFileSync(PART1_IMAGE_PATH)
    part1ImageUrl = toDataUrl(buf, path.basename(PART1_IMAGE_PATH))
    console.log('Using Part One image:', PART1_IMAGE_PATH)
  } else {
    part1ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Part One image not found — add', PART1_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PART1_IMAGE_FILE_URL\}\}/g, part1ImageUrl)

  // Part Two — Brain Drain section divider (brain / neural network image)
  let part2ImageUrl
  if (PART2_IMAGE_PATH) {
    const buf = fs.readFileSync(PART2_IMAGE_PATH)
    part2ImageUrl = toDataUrl(buf, path.basename(PART2_IMAGE_PATH))
    console.log('Using Part Two image:', PART2_IMAGE_PATH)
  } else {
    part2ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Part Two image not found — add', PART2_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PART2_IMAGE_FILE_URL\}\}/g, part2ImageUrl)

  // Part Three — TVET section divider (hands on technical equipment)
  let part3ImageUrl
  if (PART3_IMAGE_PATH) {
    const buf = fs.readFileSync(PART3_IMAGE_PATH)
    part3ImageUrl = toDataUrl(buf, path.basename(PART3_IMAGE_PATH))
    console.log('Using Part Three image:', PART3_IMAGE_PATH)
  } else {
    part3ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Part Three image not found — add', PART3_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PART3_IMAGE_FILE_URL\}\}/g, part3ImageUrl)

  // Part Four — Regional Spotlight (women in workshop / labour markets)
  let part4ImageUrl
  if (PART4_IMAGE_PATH) {
    const buf = fs.readFileSync(PART4_IMAGE_PATH)
    part4ImageUrl = toDataUrl(buf, path.basename(PART4_IMAGE_PATH))
    console.log('Using Part Four image:', PART4_IMAGE_PATH)
  } else {
    part4ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Part Four image not found — add', PART4_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PART4_IMAGE_FILE_URL\}\}/g, part4ImageUrl)

  // Part Five — Policy, Plans & Politics (monument/fountain/Ghana flag)
  let part5ImageUrl
  if (PART5_IMAGE_PATH) {
    const buf = fs.readFileSync(PART5_IMAGE_PATH)
    part5ImageUrl = toDataUrl(buf, path.basename(PART5_IMAGE_PATH))
    console.log('Using Part Five image:', PART5_IMAGE_PATH)
  } else {
    part5ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Part Five image not found — add', PART5_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PART5_IMAGE_FILE_URL\}\}/g, part5ImageUrl)

  // Page 14 — Brain Drain feature (Kotoka / nation's export — Ghana Gas worker photo)
  let page14ImageUrl
  if (PAGE14_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE14_IMAGE_PATH)
    page14ImageUrl = toDataUrl(buf, path.basename(PAGE14_IMAGE_PATH))
    console.log('Using Page 14 image:', PAGE14_IMAGE_PATH)
  } else {
    page14ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 14 image not found — add', PAGE14_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE14_IMAGE_FILE_URL\}\}/g, page14ImageUrl)

  // Page 22 — TVET Feature (welding workshop / Accra Technical University)
  let page22ImageUrl
  if (PAGE22_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE22_IMAGE_PATH)
    page22ImageUrl = toDataUrl(buf, path.basename(PAGE22_IMAGE_PATH))
    console.log('Using Page 22 image:', PAGE22_IMAGE_PATH)
  } else {
    page22ImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 22 image not found — add', PAGE22_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE22_IMAGE_FILE_URL\}\}/g, page22ImageUrl)

  // Page 44 — Sidebar photo under "Binding employer standards / Proposed"
  let page44NapImageUrl
  if (PAGE44_NAP_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE44_NAP_IMAGE_PATH)
    page44NapImageUrl = toDataUrl(buf, path.basename(PAGE44_NAP_IMAGE_PATH))
    console.log('Using Page 44 sidebar image:', PAGE44_NAP_IMAGE_PATH)
  } else {
    page44NapImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 44 sidebar image not found — add', PAGE44_NAP_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE44_NAP_IMAGE_FILE_URL\}\}/g, page44NapImageUrl)

  // Page 44 — Sidebar weaving/loom image (fills black negative space under first photo)
  let page44WeavingImageUrl
  if (PAGE44_WEAVING_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE44_WEAVING_IMAGE_PATH)
    page44WeavingImageUrl = toDataUrl(buf, path.basename(PAGE44_WEAVING_IMAGE_PATH))
    console.log('Using Page 44 weaving image:', PAGE44_WEAVING_IMAGE_PATH)
  } else {
    page44WeavingImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 44 weaving image not found — add', PAGE44_WEAVING_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE44_WEAVING_IMAGE_FILE_URL\}\}/g, page44WeavingImageUrl)

  // Grace Sarpong, licensed electrician (page 30 + page 71)
  let graceElectricianImageUrl
  if (GRACE_ELECTRICIAN_IMAGE_PATH) {
    const buf = fs.readFileSync(GRACE_ELECTRICIAN_IMAGE_PATH)
    graceElectricianImageUrl = toDataUrl(buf, path.basename(GRACE_ELECTRICIAN_IMAGE_PATH))
    console.log('Using Grace electrician image:', GRACE_ELECTRICIAN_IMAGE_PATH)
  } else {
    graceElectricianImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Grace electrician image not found — add', GRACE_ELECTRICIAN_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{GRACE_ELECTRICIAN_IMAGE_FILE_URL\}\}/g, graceElectricianImageUrl)

  // Suame Magazine — Kumasi industrial cluster (mechanics/workshop)
  let suameMagazineImageUrl
  if (SUAME_MAGAZINE_IMAGE_PATH) {
    const buf = fs.readFileSync(SUAME_MAGAZINE_IMAGE_PATH)
    suameMagazineImageUrl = toDataUrl(buf, path.basename(SUAME_MAGAZINE_IMAGE_PATH))
    console.log('Using Suame Magazine image:', SUAME_MAGAZINE_IMAGE_PATH)
  } else {
    suameMagazineImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Suame Magazine image not found — add', SUAME_MAGAZINE_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{SUAME_MAGAZINE_IMAGE_FILE_URL\}\}/g, suameMagazineImageUrl)

  // Page 70 — Photo Essay: Foreman, Welder, Artisan
  let page70ForemanImageUrl
  if (PAGE70_FOREMAN_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE70_FOREMAN_IMAGE_PATH)
    page70ForemanImageUrl = toDataUrl(buf, path.basename(PAGE70_FOREMAN_IMAGE_PATH))
    console.log('Using Page 70 Foreman image:', PAGE70_FOREMAN_IMAGE_PATH)
  } else {
    page70ForemanImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 70 Foreman image not found — add', PAGE70_FOREMAN_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE70_FOREMAN_IMAGE_FILE_URL\}\}/g, page70ForemanImageUrl)

  let page70WelderImageUrl
  if (PAGE70_WELDER_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE70_WELDER_IMAGE_PATH)
    page70WelderImageUrl = toDataUrl(buf, path.basename(PAGE70_WELDER_IMAGE_PATH))
    console.log('Using Page 70 Welder image:', PAGE70_WELDER_IMAGE_PATH)
  } else {
    page70WelderImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 70 Welder image not found — add', PAGE70_WELDER_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE70_WELDER_IMAGE_FILE_URL\}\}/g, page70WelderImageUrl)

  let page70ArtisanImageUrl
  if (PAGE70_ARTISAN_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE70_ARTISAN_IMAGE_PATH)
    page70ArtisanImageUrl = toDataUrl(buf, path.basename(PAGE70_ARTISAN_IMAGE_PATH))
    console.log('Using Page 70 Artisan image:', PAGE70_ARTISAN_IMAGE_PATH)
  } else {
    page70ArtisanImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 70 Artisan image not found — add', PAGE70_ARTISAN_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE70_ARTISAN_IMAGE_FILE_URL\}\}/g, page70ArtisanImageUrl)

  // Page 71 — Nurse, Technician, The North
  let page71NurseImageUrl
  if (PAGE71_NURSE_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE71_NURSE_IMAGE_PATH)
    page71NurseImageUrl = toDataUrl(buf, path.basename(PAGE71_NURSE_IMAGE_PATH))
    console.log('Using Page 71 Nurse image:', PAGE71_NURSE_IMAGE_PATH)
  } else {
    page71NurseImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 71 Nurse image not found — add', PAGE71_NURSE_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE71_NURSE_IMAGE_FILE_URL\}\}/g, page71NurseImageUrl)

  let page71TechnicianImageUrl
  if (PAGE71_TECHNICIAN_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE71_TECHNICIAN_IMAGE_PATH)
    page71TechnicianImageUrl = toDataUrl(buf, path.basename(PAGE71_TECHNICIAN_IMAGE_PATH))
    console.log('Using Page 71 Technician image:', PAGE71_TECHNICIAN_IMAGE_PATH)
  } else {
    page71TechnicianImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 71 Technician image not found — add', PAGE71_TECHNICIAN_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE71_TECHNICIAN_IMAGE_FILE_URL\}\}/g, page71TechnicianImageUrl)

  let page71NorthImageUrl
  if (PAGE71_NORTH_IMAGE_PATH) {
    const buf = fs.readFileSync(PAGE71_NORTH_IMAGE_PATH)
    page71NorthImageUrl = toDataUrl(buf, path.basename(PAGE71_NORTH_IMAGE_PATH))
    console.log('Using Page 71 North image:', PAGE71_NORTH_IMAGE_PATH)
  } else {
    page71NorthImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Page 71 North image not found — add', PAGE71_NORTH_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{PAGE71_NORTH_IMAGE_FILE_URL\}\}/g, page71NorthImageUrl)

  // Hon. Cecilia Dapaah-Ntim — Minister portrait (Interview page)
  let ceciliaDapaahImageUrl
  if (CECILIA_DAPAAH_IMAGE_PATH) {
    const buf = fs.readFileSync(CECILIA_DAPAAH_IMAGE_PATH)
    ceciliaDapaahImageUrl = toDataUrl(buf, path.basename(CECILIA_DAPAAH_IMAGE_PATH))
    console.log('Using Cecilia Dapaah-Ntim image:', CECILIA_DAPAAH_IMAGE_PATH)
  } else {
    ceciliaDapaahImageUrl = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    console.warn('Cecilia Dapaah-Ntim image not found — add', CECILIA_DAPAAH_IMAGE_BASE + '.png or .jpg to', ECONOMIST_ASSETS)
  }
  html = html.replace(/\{\{CECILIA_DAPAAH_IMAGE_FILE_URL\}\}/g, ceciliaDapaahImageUrl)

  html = html.replace('</head>', `<style>${PRINT_CSS}</style></head>`)

  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 120000,
    })
    await page.emulateMediaType('print')

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

    // Export first page as PNG for magazine thumbnail (front cover) on /economist and /news
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
