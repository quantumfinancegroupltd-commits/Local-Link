/**
 * Seed LocalLink Economist issues (Volume 01 — January 2026, Volume 02 — February 2026).
 * PDFs: generate with generate-economist-volume-0X-pdf-from-html.js.
 *
 * Requires DATABASE_URL.
 *
 * Local: DATABASE_URL='postgresql://...' node backend/scripts/seed-economist-issue.js
 * Production: deploy_mac.sh full runs this inside the API container.
 */
import 'dotenv/config'
import { env } from '../src/config.js'
import { pool } from '../src/db/pool.js'

if (!env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is required. Set it in .env or: DATABASE_URL=\'postgresql://...\' node backend/scripts/seed-economist-issue.js')
  process.exit(1)
}

const ISSUES = [
  {
    slug: 'volume-01-january-2026',
    volume_number: 1,
    issue_date: '2026-01-15',
    theme: 'The State of Skilled Labour in Ghana',
    title: 'The State of Skilled Labour in Ghana',
    summary: 'Wages, demand shifts, and the transformation of Ghana’s local work economy. Labour market overview, construction cost index, produce market intelligence, and outlook for Q1–Q2 2026.',
    pdf_url: '/economist-volume-01.pdf',
    cover_image_url: '/economist-volume-01-cover.png',
    page_count: 28,
    featured_headline_1: 'The Real Cost of Hiring an Electrician in Accra',
    featured_headline_2: 'Why Masonry Prices Increased 18% in 12 Months',
    featured_headline_3: 'The Rise of Informal Digital Work Platforms',
    is_published: true,
  },
  {
    slug: 'volume-02-february-2026',
    volume_number: 2,
    issue_date: '2026-02-15',
    theme: 'Construction & Infrastructure Pricing Index',
    title: 'Construction & Infrastructure Pricing Index, Ghana 2026',
    summary: 'Ghana\'s most comprehensive survey of construction materials, labour rates, and project costs — 142 data points across 9 regions, Q4 2025. CIPI at 128.4 (+8.3% YoY), cement at GH₵ 90/bag, regional premiums from Accra to Tamale.',
    pdf_url: '/economist-volume-02.pdf',
    cover_image_url: '/economist-volume-02-cover.png',
    page_count: 32,
    featured_headline_1: 'Cement at GH₵ 90/Bag: The Cost Crisis in Context',
    featured_headline_2: 'Full Materials Price Index — 142 Line Items',
    featured_headline_3: 'Why Tamale Builds at 34% More Than Accra',
    is_published: true,
  },
  {
    slug: 'volume-03-march-2026',
    volume_number: 3,
    issue_date: '2026-03-15',
    theme: 'Women in Skilled Trades',
    title: 'Women in Skilled Trades — Ghana 2026',
    summary: 'Breaking barriers, building Ghana — how women are entering, surviving, and transforming the skilled trades workforce. Enrolment, employment, wages, and outcomes; eight women in eight trades; TVET reform and policy priorities.',
    pdf_url: '/economist-volume-03.pdf',
    cover_image_url: '/economist-volume-03-cover.png',
    page_count: 32,
    featured_headline_1: 'The Gender Pay Gap Across 18 Trades',
    featured_headline_2: 'Eight Women, Eight Trades — From Accra to Tamale',
    featured_headline_3: 'What TVET Reform Must Do to Close the Gender Gap',
    is_published: true,
  },
]

async function main() {
  for (const issue of ISSUES) {
    await pool.query(
      `insert into economist_issues (
         slug, volume_number, issue_date, theme, title, summary, pdf_url, cover_image_url,
         page_count, featured_headline_1, featured_headline_2, featured_headline_3, is_published
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (slug) do update set
         volume_number = excluded.volume_number,
         issue_date = excluded.issue_date,
         theme = excluded.theme,
         title = excluded.title,
         summary = excluded.summary,
         pdf_url = coalesce(excluded.pdf_url, economist_issues.pdf_url),
         cover_image_url = coalesce(excluded.cover_image_url, economist_issues.cover_image_url),
         page_count = excluded.page_count,
         featured_headline_1 = excluded.featured_headline_1,
         featured_headline_2 = excluded.featured_headline_2,
         featured_headline_3 = excluded.featured_headline_3,
         is_published = true,
         updated_at = now()`,
      [
        issue.slug,
        issue.volume_number,
        issue.issue_date,
        issue.theme,
        issue.title,
        issue.summary,
        issue.pdf_url,
        issue.cover_image_url,
        issue.page_count,
        issue.featured_headline_1,
        issue.featured_headline_2,
        issue.featured_headline_3,
        issue.is_published,
      ],
    )
    console.log('LocalLink Economist issue', issue.slug, 'ensured (created or updated, is_published=true).')
  }
  console.log('PDFs: /economist-volume-01.pdf, /economist-volume-02.pdf, /economist-volume-03.pdf (generate with: node backend/scripts/generate-economist-volume-0X-pdf-from-html.js)')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
