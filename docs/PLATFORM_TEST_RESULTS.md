# LocalLink platform test results

**Date:** 2026-02-21  
**Environment:** https://locallink.agency  
**Demo accounts:** See main test plan; password for all: `Ghana2025!`

---

## Summary

| Phase | Area | Status | Notes |
|-------|------|--------|--------|
| 1 | Account – Login | ✅ Pass | Akua Mensah (Buyer) login OK; redirect to /buyer |
| 1 | Account – Profile | ✅ Pass | Profile loads; tabs: Posts, About, Resume, **Activity**, Edit profile |
| 1 | Activity timeline | ✅ Pass | Activity tab works; URL `?tab=activity` |
| 1 | Logout | ⏳ Not run | Menu shows Logout; not executed in this run |
| 1 | API smoke (login + profile + timeline) | ✅ Pass | Run: `cd backend && API_BASE_URL=https://locallink.agency node scripts/api-smoke.mjs` |
| 1 | API smoke (marketplace + artisans) | ✅ Pass | Same script: `/api/marketplace/services`, `/api/artisans` |
| 1 | API smoke all 9 demo roles | ✅ Pass | Run: `cd backend && API_BASE_URL=https://locallink.agency npm run api-smoke:roles` |
| 3 | Discovery – Search URL | ⚠️ 404 | `/search?q=carpenter` → Page not found. Use **/buyer/providers** or **/marketplace** instead |
| 3 | Discovery – Find providers | ⏳ Not run | Navigate to /buyer/providers and use in-page search/filters |
| 3 | Discovery – Browse produce | ⏳ Not run | Navigate to /marketplace |

---

## What was tested (automated)

1. **Login** – Filled `akua.mensah@demo.locallink.agency` / `Ghana2025!` → Sign in → redirected to `/buyer`.
2. **Buyer dashboard** – Loaded; "Post a job", "Find providers", "Browse produce", spend summary, "No jobs yet" card visible.
3. **Profile** – Opened from menu; profile page with cover, profile photo, tabs (Posts, About, Resume, Activity, Edit profile), bio, "View as public", profile strength.
4. **Activity tab** – Clicked Activity → URL `profile?tab=activity`; Activity section present (unified timeline).
5. **Search URL** – Navigated to `/search?q=carpenter` → **Page not found** (no `/search` route). Correct discovery routes: `/buyer/providers` (Find providers), `/marketplace` (Browse produce).

---

## Correct URLs for your test plan

- **Login:** https://locallink.agency/login  
- **Find providers (discovery):** https://locallink.agency/buyer/providers  
- **Browse produce:** https://locallink.agency/marketplace  
- **Messages:** https://locallink.agency/messages  
- **Profile:** https://locallink.agency/profile  
- **Activity tab:** https://locallink.agency/profile?tab=activity  

---

## Recommended next steps (manual)

1. **Phase 1 – Account**
   - Logout, then log in with each demo account (Buyer, Artisan, Farmer, Driver, Company).
   - Test: Reset password, change email, update profile photo/bio/phone, notifications.
   - Edge: Wrong password 10×; login from two browsers.

2. **Phase 2 – Listings**
   - As Kofi (Artisan): add services (Furniture repair, Door installation, Kitchen cabinets).
   - As Abena (Farmer): add products (Tomatoes, Cassava, Maize).
   - As Yaw (Driver): add transport services.
   - Test edit, delete, mark unavailable, duplicates; edge cases (price 0, negative, very long text).

3. **Phase 3 – Discovery**
   - As Akua / Ama: open **/buyer/providers** and **/marketplace**, use search/filters (e.g. carpenter, tomatoes, tailoring).
   - Try misspellings and partial words.

4. **Phase 4 – Messaging**
   - Create threads: Akua → Kofi, Afia, Kwame; Ama → Abena, Yaw.
   - Check notifications, unread counts, order, and edge (many messages, long paste, links).

5. **Phases 5–20**
   - Follow the main bulletproof test plan (reputation, transactions, fraud simulation, admin, notifications, mobile, load, edge cases, analytics, chaos).

---

## Demo accounts quick reference

| Name | Email | Role |
|------|--------|------|
| Akua Mensah | akua.mensah@demo.locallink.agency | Buyer |
| Kofi Asante | kofi.asante@demo.locallink.agency | Artisan |
| Abena Osei | abena.osei@demo.locallink.agency | Farmer |
| Yaw Boateng | yaw.boateng@demo.locallink.agency | Driver |
| Afia Addo | afia.addo@demo.locallink.agency | Artisan |
| Ama Serwaa | ama.serwaa@demo.locallink.agency | Company |
| Kwame Owusu | kwame.owusu@demo.locallink.agency | Artisan |
| Esi Tawiah | esi.tawiah@demo.locallink.agency | Artisan |
| Kwabena Mensah | kwabena.mensah@demo.locallink.agency | Artisan |

**Password for all:** `Ghana2025!`

---

## Continue testing (API smoke)

Run from **inside the LocalLink repo** (e.g. `cd ~/Desktop/LocalLink` first), or use the full path below.

**All 9 demo roles (from anywhere):**
```bash
cd ~/Desktop/LocalLink/backend && API_BASE_URL=https://locallink.agency npm run api-smoke:roles
```

**Single run (one demo user, default Buyer):**
```bash
cd ~/Desktop/LocalLink/backend && API_BASE_URL=https://locallink.agency npm run api-smoke
```

**From repo root** (after `cd ~/Desktop/LocalLink`):
```bash
cd backend && API_BASE_URL=https://locallink.agency npm run api-smoke:roles
```

**Local backend (port 4000):**
```bash
cd ~/Desktop/LocalLink/backend && npm run api-smoke:roles
```

**One role (e.g. Artisan):**
```bash
cd ~/Desktop/LocalLink/backend && DEMO_EMAIL=kofi.asante@demo.locallink.agency DEMO_PASSWORD=Ghana2025! API_BASE_URL=https://locallink.agency node scripts/api-smoke.mjs
```

Smoke checks: health, ready, 401 for unauthed wallets/escrow, **marketplace/services**, **artisans**, login, profile/me, timeline.
