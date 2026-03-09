# LocalLink Economist — What’s Done & What’s Next

## Seed: Volume 01

- **Script**: `backend/scripts/seed-economist-issue.js` — creates one published issue (Volume 01 — January 2026) with your theme, title, summary, headlines; cover = Unsplash image; PDF = placeholder (replace via Admin).
- **Deploy**: Full deploy runs this seed after `seed-demo-users.js`. To run manually: `cd backend && node scripts/seed-economist-issue.js`.

## What we’ve done (current state)

### Backend
- **Table** `economist_issues`: slug, volume_number, issue_date, theme, title, summary, pdf_url, cover_image_url, page_count, featured_headline_1/2/3, is_published, created_by, timestamps.
- **Public API**: `GET /api/economist` (published list), `GET /api/economist/:slug` (single issue).
- **Admin API**: Full CRUD at `/api/admin/economist` (list, get, create, update, delete).
- **Upload**: `POST /api/uploads/economist` (admin only): multipart `pdf` + `cover_image`; returns `pdf_url`, `cover_image_url`.

### Admin dashboard
- **LocalLink Economist** tab: list of issues with **All / Published / Draft** filter, “Upload New Issue”, create/edit form (PDF + cover upload, slug, volume, date, theme, title, summary, 3 headlines, page count, published toggle), delete.
- **Auto page count**: on economist upload the backend returns `page_count` from the PDF; the form pre-fills it.

### News page (`/news`)
- **LocalLink Economist** section (when “All” is selected): header “LocalLink Economist”, subheading, **Read Latest Issue** + **Browse Archive**, horizontal slider of issue cards (cover, volume, date, title, summary or headlines, “Read Issue →”).

### Reader & archive
- **`/economist`**: Archive page — grid of all published issues; “Back to News”.
- **`/economist/:slug`**: Reader with **react-pdf**:
  - Page navigation: ‹ › toolbar and **← / →** keyboard.
  - Zoom: − / + (60%–200%).
  - Fullscreen, Download, Share.
  - **Cite this report**: formatted citation + “Copy citation”.
  - **Two-page spread** on desktop (≥1024px); single page on mobile.
  - **Touch swipe** left/right to turn pages on mobile.
  - **TOC sidebar**: “Contents” with jump-to-page (sticky on desktop, drawer on mobile).
  - **Page-turn**: brief opacity transition when changing page.
  - Text layer for selection; error state and “Open in new tab” fallback.

### Analytics & SEO
- **Read tracking**: `economist_read_tracking` table; `POST /api/economist/read` (body: `issue_slug`, `pages_viewed`, `time_spent_seconds`, `completed`). Reader pings on tab hide and unmount (optional auth).
- **Per-issue SEO**: `usePageMeta` sets `og:image` (cover) and `og:url` for the issue page.

### Design
- Economist block uses **#111111**, **#D71920**, serif title, clean cards and reader layout so it reads as a distinct, premium product.
- **Volume 01 PDF** is generated from `backend/scripts/economist-volume-01-design.html` via Puppeteer (`generate-economist-volume-01-pdf-from-html.js`). The HTML uses **CSS-only “scenes”** (gradients, pseudo-elements, clip-paths) for construction, workshop, Kumasi market, northern Ghana, etc. — **no real photos** are embedded. Some panels use strong gradients (browns, golds, slate, blue-grey) which can look odd or abstract.

---

## Improving the magazine (real images & colours)

**Honest answer: no, it’s not the best it can be.** Right now the PDF is 100% CSS: no real Ghana imagery, and some backgrounds are deliberately abstract (so they can read as “odd”). You can improve it in two ways:

1. **Add real Ghana images**
   - **Where**: In `economist-volume-01-design.html`, replace or overlay the `.img-panel` / `.scene-*` areas with `<img src="...">` or CSS `background-image: url(...)`.
   - **Sources**: Use royalty-free photos (e.g. Unsplash, Pexels) search “Ghana construction”, “Kumasi market”, “Accra”, “Ghana workers”, “TVET Ghana”, etc. Download and put under e.g. `backend/scripts/economist-assets/` and reference by relative path so Puppeteer can load them when generating the PDF.
   - **Print CSS**: Keep `@media print` rules and ensure images have reasonable size/object-fit so the PDF looks good.

2. **Tone down odd colours**
   - **Design file**: Edit the `:root` and scene variables in `economist-volume-01-design.html` (e.g. `--cream`, `--gold`, and the gradient colours in `.scene-construction`, `.scene-workshop`, `.scene-kumasi`, `.scene-north`, etc.).
   - Use warmer, more natural Ghana-appropriate greens, earth tones and golds; reduce harsh blue-greys or orange industrial tones if they feel off. Regenerate the PDF after changes: `cd backend && node scripts/generate-economist-volume-01-pdf-from-html.js`, then re-upload or replace `frontend/public/economist-volume-01.pdf` and redeploy if needed.

---

## Is this the best we can do?

**For a first launch: yes.** You have end-to-end flow (admin upload → news section → archive → reader with navigation, zoom, fullscreen, citation). It’s consistent, on-brand, and usable.

**Possible next steps** (when you want to invest more):

| Area | Idea | Effort |
|------|------|--------|
| **Reader** | Animated “page turn” (e.g. CSS 3D flip) | Medium |
| **Admin** | Auto thumbnail from first PDF page (optional fallback for cover) | Medium |
| **Monetisation** | Gated download or “Subscribe” CTA in reader (Phase 2) | Low–medium |

---

## Recommendation

Ship what you have. It’s solid for “Ghana’s local economy briefing” and positions LocalLink as a data authority. Add two-page spread, TOC, or read tracking when you have a concrete need (e.g. investor deck, premium tier).

**One rule from your spec:** publish consistently. Even if an issue is shorter, monthly cadence matters more than perfection for authority.
