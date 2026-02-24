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

## 4. Seed demo data (required for Marketplace services and landing content)

**If the Marketplace "Services" tab or the landing page sections (Farmers & Florists, Provider services, Employers) are empty**, the database needs demo data. Run the seed **on the server** (same machine as the API, using the same `DATABASE_URL` as the API):

```bash
cd ~/LocalLink/backend
export $(grep -v '^#' .env | xargs)
node scripts/seed-demo-users.js
```

Password for all demo logins: **Ghana2025!**

To check whether demo data is already present:

```bash
cd ~/LocalLink/backend
node scripts/check-demo-data.js
```

If it reports 0 artisan_services (or 0 products / 0 job_posts), run the seed command above.

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
