# Deploy from your Mac to https://locallink.agency

Run these from your **home machine** (Mac) and then on the **server**. Replace placeholders with your actual server host and key path.

---

## 1. Sync code to the server (from your Mac)

**Option A — rsync (recommended; fast incremental)**

```bash
cd /Users/richardholland/Desktop/LocalLink

./deploy/deploy_mac.sh ubuntu@YOUR_SERVER_IP_OR_HOST "/path/to/your/key.pem"
```

Example with the Local Link SSH key (in Downloads):

```bash
./deploy/deploy_mac.sh ubuntu@YOUR_SERVER_IP_OR_HOST "$HOME/Downloads/Local Link SSH Key/ssh-key-2026-02-18 (2).key"
```

**Option B — Git (if the server has the repo and you push to a remote)**

```bash
cd /Users/richardholland/Desktop/LocalLink
git add -A && git commit -m "Deploy" && git push origin main
```

Then on the server you will run `git pull` in step 3.

---

## 2. SSH into the server

```bash
ssh -i /path/to/your/key.pem ubuntu@YOUR_SERVER_IP_OR_HOST
```

---

## 3. On the server: build, migrate, restart

Run these **on the server** after SSH (same order):

```bash
cd ~/LocalLink
```

If you used **Option B** (Git) in step 1:

```bash
git fetch origin && git checkout main && git pull origin main
```

Then:

```bash
# Backend deps and migrations
cd ~/LocalLink/backend
npm ci
npm run migrate
cd ~/LocalLink

# Frontend deps and build (same-origin /api; do not set VITE_API_BASE_URL to localhost)
cd ~/LocalLink/frontend
npm ci
npm run build
cd ~/LocalLink

# Restart API and worker
pm2 restart locallink-api locallink-worker

# Reload Caddy only if you changed Caddyfile
# sudo systemctl reload caddy
```

---

## 4. Seed demo data (required for Marketplace, Employers, and Feed)

**If the Marketplace "Services" tab, landing page sections, or the Feed is empty**, run the seeds **on the server** using the **same database** as the running API.

### With Docker (recommended when using docker-compose.selfhost.yml)

The API container must connect to the `db` service. Run the feed seed with that URL explicitly so it writes to the same DB the API reads from:

```bash
cd ~/LocalLink
docker compose -f docker-compose.selfhost.yml run --rm \
  -e DATABASE_URL=postgresql://locallink:locallink@db:5432/locallink \
  api node scripts/seed-demo-feed.js
```

(If you need demo users/products first, run `seed-demo-users.js` the same way, or ensure it was run previously.)

**If the feed is still empty after seeding:**

1. **Same DB check** — The running API must use the same database. On the server:
   ```bash
   docker compose -f docker-compose.selfhost.yml exec api printenv DATABASE_URL
   ```
   It should contain `@db:5432`. If it shows `localhost` or another host, the API is using a different DB than the seed. Either remove or change `DATABASE_URL` in the server’s `.env` so the API uses the default `postgresql://locallink:locallink@db:5432/locallink`, or run the seed with the same URL the API uses.

2. **New session** — Log out on the site, then log in again as a demo user (e.g. `kwabena.mensah@demo.locallink.agency` / `Ghana2025!`) and open the feed. Old sessions can point at a previous user id.

**Demo user data:** Re-running `seed-demo-users.js` no longer deletes and recreates demo users; it updates them in place so user IDs stay stable and existing sessions/feed keep working. Only `seed-demo-feed.js` still wipes and re-creates feed data (posts and follows between demo users).

**Feed page looks old (e.g. “Share an update, new hire…” or no “Log out and sign in again”):** The app shell may be cached. Do a hard refresh (Cmd+Shift+R) or open the site in a private/incognito window, then log in and try the feed again.

### Without Docker (npm + pm2)

```bash
cd ~/LocalLink/backend
export $(grep -v '^#' .env | xargs)
node scripts/seed-demo-users.js
node scripts/seed-demo-feed.js
```

- **seed-demo-users.js** — Demo users (buyer, artisan, farmer, driver, company), products, services, job posts.
- **seed-demo-feed.js** — Feed posts from demo users and follows so the feed is populated. Includes one **sponsored job post** (Ama Serwaa – carpenters) and one **boosted service post** (Kwame – plumbing).

Password for all demo logins: **Ghana2025!**

To check whether demo data is already present:

```bash
cd ~/LocalLink/backend
node scripts/check-demo-data.js
```

If it reports 0 artisan_services (or 0 products / 0 job_posts), run the seed commands above.

---

## 5. Verify

- Open **https://locallink.agency/** and do a hard refresh (Cmd+Shift+R).
- Check API: **https://locallink.agency/api/health** (should return `{"ok":true}`).

---

## One-liner (from Mac) after you’ve run rsync or pushed once

If you’ve already synced code and only need to run the server steps, you can do everything in one SSH session:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_SERVER_IP_OR_HOST 'cd ~/LocalLink/backend && npm ci && npm run migrate && cd ~/LocalLink/frontend && npm ci && npm run build && cd ~/LocalLink && pm2 restart locallink-api locallink-worker'
```

Then open https://locallink.agency/
