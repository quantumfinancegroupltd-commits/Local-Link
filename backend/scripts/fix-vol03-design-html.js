/**
 * Fix truncated back-cover in Vol 03 design HTML and write to economist-volume-03-design.html.
 * Usage: node backend/scripts/fix-vol03-design-html.js < path/to/pasted-vol03.html
 *    or: node backend/scripts/fix-vol03-design-html.js path/to/pasted-vol03.html
 *    or: node backend/scripts/fix-vol03-design-html.js  (reads from economist-volume-03-design.html and overwrites it)
 *
 * Reads HTML from stdin, from the file path argument, or from economist-volume-03-design.html.
 * Replaces the incomplete back-cover div (ending in ";letter-s") with the completed version and closing tags.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = path.resolve(__dirname, 'economist-volume-03-design.html')

const INCOMPLETE = "color:rgba(255,255,255,.15);letter-s"
const COMPLETE   = "color:rgba(255,255,255,.15);letter-spacing:1px\"></div></div></div></div></body></html>"

async function main() {
  let html
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PATH
  if (process.argv[2]) {
    html = fs.readFileSync(outPath, 'utf8')
  } else {
    if (!fs.existsSync(DEFAULT_PATH)) {
      console.error('No file path given and economist-volume-03-design.html not found.')
      process.exit(1)
    }
    html = fs.readFileSync(DEFAULT_PATH, 'utf8')
  }
  const idx = html.lastIndexOf(INCOMPLETE)
  if (idx === -1) {
    console.error('Truncation pattern not found. Ensure the back-cover div ends with: ...;letter-s')
    process.exit(1)
  }
  html = html.slice(0, idx + INCOMPLETE.length) + COMPLETE
  fs.writeFileSync(outPath, html)
  console.log('Written:', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
