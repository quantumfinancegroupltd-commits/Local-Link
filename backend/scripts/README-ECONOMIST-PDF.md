# LocalLink Economist — Volume 01 PDF

## Use your custom design (recommended)

1. **Save your full magazine HTML** (the design you created: front cover with skyline/lights, masthead, contents, editor’s letter, section dividers, articles, data/charts, interview, opinion, photo essay, reference data, five priorities, coming next, back cover) as:
   ```
   backend/scripts/economist-volume-01-design.html
   ```
   Replace the existing file with your complete HTML. Use the same structure: page size 794×1123px, `.page` and `.p-sep` for each page, your CSS (Playfair Display, Source Serif 4, DM Mono, Bebas Neue, Cormorant Garamond, scene-construction, scene-workshop, scene-airport, etc.). You can paste the exact HTML you designed into this file.

2. **Generate the PDF:**
   ```bash
   node backend/scripts/generate-economist-volume-01-pdf-from-html.js
   ```
   Output: `frontend/public/economist-volume-01.pdf`

3. **Re-seed the issue** (so the app uses the new PDF and page count):
   ```bash
   DATABASE_URL='postgresql://...' node backend/scripts/seed-economist-issue.js
   ```
   If your design has more than 6 pages, edit `seed-economist-issue.js` and set `page_count` to the correct number before running.

4. **Deploy** (sync + full build so the new PDF is included and seed runs on the server).

## Current design file

The repo ships with a simplified design in `economist-volume-01-design.html`. Replace it with your full design (e.g. the one with cover skyline, scene-construction, scene-workshop, all articles and data pages) to get the exact magazine you designed.

## Dependencies

- **Puppeteer** (in backend): used by `generate-economist-volume-01-pdf-from-html.js` to render HTML and export PDF.
- **pdfkit** (in backend): used by the legacy `generate-economist-volume-01-pdf.js` if you prefer generating PDF from code instead of HTML.
