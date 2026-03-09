# Economist magazine assets

Place image files here for use in the PDF designs.

---

## Volume 01 — January 2026 (Labour)

### Cover spread (pages 1–2)

- **File name:** `ghana-virgyl-sowah-e9npwgbxm9o-unsplash.jpg`
- **Usage:** Left half = cover (page 1); right half = inside front cover (page 2). Dark overlay on both.
- **Source:** Unsplash photo e9npwgbxm9o (Ghana workers/Accra). Save as above in this folder.

Regenerate PDF: `node backend/scripts/generate-economist-volume-01-pdf-from-html.js` (from repo root).

---

## Volume 02 — February 2026 (Construction & Infrastructure)

Use **correlated, relevant Ghana images** (construction, infrastructure, materials, labour) from Unsplash or similar. Prefer `.png` or `.jpg`; the generator checks both.

| Placeholder | Expected filename(s) | Usage |
|-------------|----------------------|--------|
| Cover | `cover-vol02.png` or `cover-vol02.jpg` | Front cover background (construction/crane/skyline, Ghana) |
| Back cover | `back-cover-vol02.png` or `back-cover-vol02.jpg` | Back cover background (optional; falls back to cover image) |
| Part 1 | `part1-vol02.png` or `part1-vol02.jpg` | Section divider “Part One — CIPI Overview” (e.g. Ghana skyline/site) |
| Part 2 | `part2-vol02.png` or `part2-vol02.jpg` | Section divider “Part Two — Materials” (e.g. cement bags, materials yard) |
| Part 3 | `part3-vol02.png` or `part3-vol02.jpg` | Section divider “Part Three — Labour” (e.g. masons/workers on site) |
| Part 4 | `part4-vol02.png` or `part4-vol02.jpg` | Section divider “Part Four — Regional” (e.g. Ghana regions/road/infra) |

**Suggested search terms (Unsplash / Pexels):** Ghana construction, Accra building site, Ghana cement, Ghana workers construction, Tema port Ghana, Ghana road construction, Tamale Ghana, Ghana infrastructure.

**Placeholder images:** To generate solid-colour placeholders (navy palette) so the PDF is never blank, run:  
`node backend/scripts/create-economist-vol02-placeholders.js` (from repo root).  
Then regenerate PDF: `node backend/scripts/generate-economist-volume-02-pdf-from-html.js`. Output: `frontend/public/economist-volume-02.pdf`, `frontend/public/economist-volume-02-cover.png`.
