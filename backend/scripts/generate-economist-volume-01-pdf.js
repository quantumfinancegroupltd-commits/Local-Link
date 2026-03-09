/**
 * Generate the LocalLink Economist Volume 01 PDF (The State of Skilled Labour in Ghana).
 * Economist-style: front cover, contents, articles, back cover.
 * Output: frontend/public/economist-volume-01.pdf (so the app can serve it at /economist-volume-01.pdf).
 *
 * Run from repo root: node backend/scripts/generate-economist-volume-01-pdf.js
 * Or from backend: node scripts/generate-economist-volume-01-pdf.js
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')

const OUT_PATH = path.resolve(__dirname, '../../frontend/public/economist-volume-01.pdf')
const RED = '#D71920'
const DARK = '#1a1a1a'

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function run() {
  ensureDir(path.dirname(OUT_PATH))
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  doc.pipe(fs.createWriteStream(OUT_PATH))

  // —— Front cover ——
  doc.rect(0, 0, 595, 842).fill(RED)
  doc.fillColor('#ffffff')
  doc.fontSize(11).font('Helvetica-Bold')
  doc.text('LocalLink', 50, 120, { width: 495, align: 'center' })
  doc.fontSize(28)
  doc.text('Economist', 50, 140, { width: 495, align: 'center' })
  doc.fontSize(14)
  doc.text('Vol 01 — January 2026', 50, 220, { width: 495, align: 'center' })
  doc.fontSize(22)
  doc.text('The State of Skilled Labour in Ghana', 50, 280, { width: 495, align: 'center' })
  doc.fontSize(12)
  doc.text('Wages, demand shifts, and the transformation of Ghana’s local work economy.', 50, 340, { width: 495, align: 'center' })
  doc.fillColor('#ffffff')
  doc.fontSize(10)
  doc.text('Labour market overview · Construction cost index · Produce market intelligence · Q1–Q2 2026 outlook', 50, 720, { width: 495, align: 'center' })
  doc.addPage()

  // —— Inside / Contents ——
  doc.fillColor(DARK)
  doc.fontSize(10).font('Helvetica')
  doc.text('Contents', 50, 60)
  doc.fontSize(18).font('Helvetica-Bold')
  doc.text('The State of Skilled Labour in Ghana', 50, 90, { width: 495 })
  doc.fontSize(11).font('Helvetica')
  doc.text('3  The Real Cost of Hiring an Electrician in Accra', 50, 160)
  doc.text('5  Why Masonry Prices Increased 18% in 12 Months', 50, 190)
  doc.text('7  The Rise of Informal Digital Work Platforms', 50, 220)
  doc.moveDown(3)
  doc.fontSize(10)
  doc.text('This report analyses wages, demand shifts, and the transformation of Ghana’s local work economy. It draws on labour market data, construction cost indices, produce market intelligence, and outlook for Q1–Q2 2026.', 50, 320, { width: 495, align: 'left' })
  doc.addPage()

  // —— Article 1 ——
  doc.fillColor(RED).fontSize(10).font('Helvetica')
  doc.text('LocalLink Economist · Vol 01 — January 2026', 50, 50)
  doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold')
  doc.text('The Real Cost of Hiring an Electrician in Accra', 50, 90, { width: 495 })
  doc.fontSize(11).font('Helvetica')
  doc.fillColor('#333')
  doc.text('Skilled electricians in Greater Accra have seen steady demand as construction and retrofit projects continue. This article looks at typical day rates, call-out fees, and how supply and certification affect what households and businesses pay.', 50, 140, { width: 495 })
  doc.text('Rates vary by job size and location. In central Accra, a qualified electrician might charge between GH₵ 150 and GH₵ 400 per day for residential work, with commercial and industrial jobs often priced higher. Call-out or inspection fees add to the real cost of hiring.', 50, 220, { width: 495 })
  doc.text('Demand has been driven by new builds, solar installations, and upgrades to meet safety standards. Shortages in certain specialisms can push prices up in peak periods.', 50, 320, { width: 495 })
  doc.addPage()

  // —— Article 2 ——
  doc.fillColor(RED).fontSize(10).font('Helvetica')
  doc.text('LocalLink Economist · Vol 01 — January 2026', 50, 50)
  doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold')
  doc.text('Why Masonry Prices Increased 18% in 12 Months', 50, 90, { width: 495 })
  doc.fontSize(11).font('Helvetica')
  doc.fillColor('#333')
  doc.text('Masonry and blockwork costs have risen sharply across many parts of Ghana. We examine the main drivers: materials, labour, and demand.', 50, 140, { width: 495 })
  doc.text('Cement and aggregate prices have been volatile, with fuel and logistics adding to delivered cost. Labour costs have also increased as skilled masons remain in high demand. Together, these have contributed to an estimated 18% rise in masonry prices over the past 12 months.', 50, 200, { width: 495 })
  doc.text('For households and small builders, the impact is felt on both new construction and repairs. Planning and locking in quotes earlier in the year can help manage budgets.', 50, 300, { width: 495 })
  doc.addPage()

  // —— Article 3 ——
  doc.fillColor(RED).fontSize(10).font('Helvetica')
  doc.text('LocalLink Economist · Vol 01 — January 2026', 50, 50)
  doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold')
  doc.text('The Rise of Informal Digital Work Platforms', 50, 90, { width: 495 })
  doc.fontSize(11).font('Helvetica')
  doc.fillColor('#333')
  doc.text('Digital platforms that connect workers with short-term or gig-style jobs are growing in Ghana. They sit alongside traditional hiring and informal word-of-mouth.', 50, 140, { width: 495 })
  doc.text('From ride-hailing and delivery to task-based skilled work, these platforms are changing how some people find work and how businesses source labour. Regulation and worker protection remain evolving issues.', 50, 220, { width: 495 })
  doc.text('This article summarises trends and what they mean for the state of skilled labour in the year ahead.', 50, 300, { width: 495 })
  doc.addPage()

  // —— Back cover ——
  doc.rect(0, 0, 595, 842).fill('#f5f5f5')
  doc.fillColor(DARK)
  doc.fontSize(12).font('Helvetica-Bold')
  doc.text('LocalLink Economist', 50, 350, { width: 495, align: 'center' })
  doc.fontSize(10).font('Helvetica')
  doc.text('A monthly digital magazine analysing Ghana’s local labour, trade, produce and SME economy.', 50, 380, { width: 495, align: 'center' })
  doc.text('locallink.agency', 50, 450, { width: 495, align: 'center' })
  doc.fontSize(9)
  doc.text('Vol 01 — January 2026 · The State of Skilled Labour in Ghana', 50, 500, { width: 495, align: 'center' })

  doc.end()
  console.log('Written:', OUT_PATH)
}

run()
