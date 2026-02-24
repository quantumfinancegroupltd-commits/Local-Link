# LocalLink Social Feed — Architecture & Implementation

**Goal:** Turn the Feed into a marketplace social layer (discovery, trust, monetization) while keeping the existing posts system intact.

---

## Current State

| Area | What exists |
|------|-------------|
| **Page** | `frontend/src/pages/feed/Feed.jsx` — 2-column (main + right), CreatePostCard, SocialPostCard, Suggested (follows) |
| **API** | `GET /api/posts/feed` — posts from people you follow + your own; `order by created_at desc`, limit 100; no cursor |
| **Posts** | `user_posts` (id, user_id, body, media, created_at); likes/comments on `user_post_likes`, `user_post_comments` |
| **Follows** | `user_follows`, `POST /follows/:userId`, `GET /follows/suggested/list` |
| **Gaps** | No ranking, no cursor, no post types (produce/job/service), no left nav, no trending, no discover search |

---

## Target Principles

- **Action driven** — CTAs: Buy, Hire, Apply, Share
- **Marketplace aware** — Produce, service, job, delivery post types
- **Trust focused** — Verification badges, report, quality signals
- **Mobile friendly** — Sidebars collapse to top sections / horizontal scroll
- **Monetization ready** — Sponsored posts, boost job/listing

---

## Layout (Target)

- **Desktop:** Left 260px | Main fluid (max 720px) | Right 320px; container max-width 1280px, gap 24px
- **Mobile:** Main feed only; Trending / Suggested / Events as horizontal scroll above feed
- **Top nav:** Logo, global search → `/discover?q=`, Post Job, Notifications, Profile

---

## Data Model (Existing + Extensions)

### Existing

- `user_posts`: id, user_id, body, media (jsonb), created_at
- `user_post_likes`, `user_post_comments` (with replies, likes, reports)

### Future migrations (when adding post types)

- `user_posts`: add optional `type` ('update' | 'produce' | 'service' | 'job' | 'delivery' | 'sponsored'), `related_id` (job_id, product_id, etc.), `sponsored`, `visibility`
- Or keep single-type posts and add a separate **feed_items** aggregation table that references posts + jobs + products for a unified feed (recommended for ranking and diversity)

---

## Feed Ranking Algorithm

Score = Recency + Engagement + Relationship + Distance + Boost

| Signal | Weight | Notes |
|--------|--------|--------|
| Recency | e.g. 50 if &lt; 2h | New posts surface first |
| Engagement | likes×2 + comments×3 + shares×5 | Hot content rises |
| Relationship | +25 if viewer follows author | Following feed |
| Distance | +20 if author nearby | Optional, needs viewer lat/lng |
| Sponsored | +100 | Revenue; clear label in UI |

Order: `ORDER BY score DESC, created_at DESC`. Cursor = last item’s `(created_at, id)`.

---

## API (Target)

- **GET /api/posts/feed** (or **GET /api/feed**)
  - Query: `cursor`, `limit` (default 20), optional `location`, `followingOnly`
  - Response: `{ items: FeedItem[], next_cursor?: string }`
  - Items: post + author (name, role, avatar, verification) + like_count, comment_count, viewer_liked

---

## Component Architecture (Target)

```
/components/feed
  FeedPage         — data: useFeed (cursor, loadMore), layout
  FeedLayout       — 3-col grid; left sidebar, main, right sidebar
  FeedComposer     — Share update / photo / video (existing CreatePostCard)
  FeedList         — maps items to FeedPost; infinite scroll trigger
  FeedPost         — wrapper: switch by type → StandardPost | ProducePost | JobPost | …
  FeedActions      — Like, Comment, Share (existing in SocialPostCard)
  FeedSidebarLeft  — Nav: Home, Trending, My Network, Jobs & Offers, Marketplace, Messages
  FeedSidebarRight — Suggested to Follow, Trending Now, Local Events (placeholders)
```

---

## Phased Implementation

### Phase 1 (foundation) — **Implement first**
- [x] Doc: architecture + ranking + schema notes
- [ ] Backend: ranking (recency + engagement + relationship), cursor pagination on `GET /posts/feed`
- [ ] Frontend: FeedLayout 3-column, left nav sidebar, right sidebar (Suggested + “Trending” placeholder)
- [ ] Frontend: Infinite scroll with cursor, “Load more”
- [ ] Optional: optimistic like (update UI, then API)

### Phase 2 (content & discovery) — Done
- [x] Global search bar → `/discover?q=` (header + Discover page, GET /search)
- [ ] Trending topics (static or from tags); filter feed by topic
- [x] “New posts available” banner (visibility + 90s poll; Refresh loads feed)
- [ ] Report post flow; rate limits (already partially in place)

### Phase 3 (marketplace post types) — **Done**
- [x] DB: migration `119_user_posts_type_related.sql` — `type` ('update'|'produce'|'job'|'service'), `related_type`, `related_id`, `sponsored`
- [x] Backend: POST /posts accepts `type`, `related_type`, `related_id`; ownership checks for product/job/artisan_service; GET feed/me/user include `related` payload
- [x] SocialPostCard: LinkedPostBlock for produce (Buy → product), job (View job → /jobs/:id), service (Book → /buyer/jobs/new?service=)
- [x] Share to feed: “Share to feed” on MarketplaceProductDetail (owner only) and BuyerJobDetail; POST with type + related_id, then navigate to /feed
- [x] Sponsored: “Sponsored” badge on cards; Boost/Unboost for authors of job & service posts (PATCH /posts/:id); feed ranking +100 for sponsored posts

### Phase 4 (growth & monetization)
- [ ] Local Events block (data + CTAs)
- [ ] Sponsored boost (GHS 15 for job); track CTR
- [ ] Metrics: impressions, likes, comments, CTR, follows from feed
- [ ] Seed feed (platform posts, featured providers) for launch

### Phase 5 (advanced)
- [ ] Realtime: new post / like / comment indicators (SSE or WebSocket)
- [ ] YAO: “Ask YAO about this post” (similar providers, hire, order)
- [ ] Feed map view: jobs/produce/services on map
- [ ] Trust layer: verification_level, post_quality_score, throttle low-quality

---

## Design Tokens (from spec)

- Primary: `#1C7C54`
- Accent: `#F4A261`
- Background: `#F7F7F7`
- Card: `#FFFFFF`
- Border radius: 12px
- Shadow: `0 4px 12px rgba(0,0,0,0.06)`

Use Tailwind equivalents where possible (e.g. emerald-700, rounded-xl, shadow-sm).

---

## Security & Safety

- Rate limits on post create, like, comment (already in posts.js)
- Report post → support ticket / moderation queue
- Content moderation keywords (existing); optional auto-flag
- Sponsored: only allowed for verified/approved accounts

---

## Metrics to Track (later)

- Post impressions, likes, comments, shares
- CTR on job/produce posts (Apply, Buy)
- Follows from feed
- Revenue from feed (boost, sponsored)

This doc is the single source of truth for the feed system; implement in order of phases above.
