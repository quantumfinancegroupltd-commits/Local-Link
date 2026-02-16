# Why the live site still shows "Coming soon" and how to fix it

The **repo is correct**. The live site (https://locallink.agency/) is serving an **old frontend build**. The text you see ("Coming soon (same engine, new doors)", "caregivers — trust-first") does not exist in the current codebase.

---

## 1. Confirm the new build is deployed

**Check in the browser:**

1. Open https://locallink.agency/
2. Right‑click the page → **Inspect** (or View Page Source).
3. In the **Elements** tab, find the main content wrapper. If you see  
   `data-build="locallink-2025-02-events-domestic-live"`  
   on the first big `<div>` inside `#root`, the **new** build is live.
4. If that attribute is **missing**, the site is still serving an old build.

---

## 2. Fix the deployment

**Where is the frontend for locallink.agency hosted?**

### EC2 + Docker (docker-compose.selfhost.yml)

If you deploy with Docker as in [EC2_DOMAIN_SETUP.md](EC2_DOMAIN_SETUP.md), run this **on the server** (e.g. after SSH):

```bash
cd /path/to/LocalLink   # or wherever you cloned the repo
git fetch origin
git checkout main
git pull origin main
docker compose -f docker-compose.selfhost.yml up -d --build
```

Or use the script from the repo (run on the server from the repo root):

```bash
./scripts/redeploy.sh
```

This rebuilds the **web** (frontend) and **gateway** so the new Events/Domestic tiles and copy go live.

### Vercel / Netlify / similar

- Confirm the project is connected to the **correct repo** (e.g. `quantumfinancegroupltd-commits/Local-Link`).  
- Confirm it builds from the **branch you push to** (e.g. `main`).  
- Trigger a **new deploy** (e.g. "Redeploy" in the dashboard) **after** your latest push.  
- Wait for the build to finish and check the deploy log for errors.

### Other (static host, custom server)

- Pull latest code, run `npm run build` in `frontend/`, then upload the `frontend/dist` output (or point your web server at it).

After a **successful new deploy**, do a **hard refresh** (Ctrl+Shift+R or Cmd+Shift+R) or open the site in an incognito window so the browser doesn’t use cached JS/CSS.

---

## 3. What the new build should show

- **Section title:** "Events, domestic services & more" (not "Coming soon (same engine, new doors)").
- **Events & Catering:** Clickable tile (no "Coming soon" badge).
- **Domestic & Recurring:** Clickable tile; description "Cleaners, laundry — trust-first, repeat. Care givers coming later." (not "caregivers — trust-first, repeat usage").
- **Register:** "I am a" dropdown with the updated role labels (Buyer, Artisan, Farmer / Florist, Driver, Company with the new wording).

---

## 4. One-line summary

**Repo = correct. Live site = old build.** Trigger a new frontend deploy from the correct branch, wait for it to finish, then hard refresh. Use the `data-build` attribute to confirm the new build is live.
