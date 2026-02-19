# Demo seed users (Ghana-based)

The script `backend/scripts/seed-demo-users.js` creates one user per vertical with Ghana-based names, bios, and sample data. **Password for all: `Ghana2025!`**

## How to run the seed

**On your Mac** (with DB URL pointing at your server or Supabase):

```bash
cd backend
DATABASE_URL='postgresql://...' npm run seed:demo
```

**On the server** (after SSH; uses `DATABASE_URL` from `~/LocalLink/.env`):

```bash
cd ~/LocalLink
docker compose -f docker-compose.selfhost.yml run --rm api node scripts/seed-demo-users.js
```

(Rebuild the api image first if you just added the seed script: `docker compose -f docker-compose.selfhost.yml up -d --build api`.)

---

## Logins (password for all: **Ghana2025!**)

| Name          | Email                               | Role    | What you’ll see |
|---------------|-------------------------------------|---------|------------------|
| **Akua Mensah**   | akua.mensah@demo.locallink.agency   | Buyer   | Post jobs, browse marketplace, order produce |
| **Kofi Asante**   | kofi.asante@demo.locallink.agency   | Artisan | Catering & event services; profile + **Marketplace → Services** |
| **Abena Osei**    | abena.osei@demo.locallink.agency    | Farmer  | Tomatoes, plantain, garden eggs, okro; **Marketplace → Farmers & Florists** |
| **Yaw Boateng**   | yaw.boateng@demo.locallink.agency   | Driver  | Delivery driver (Accra/Tema) |
| **Afia Addo**     | afia.addo@demo.locallink.agency     | Artisan | Domestic cleaning & laundry; **Marketplace → Services** |
| **Ama Serwaa**    | ama.serwaa@demo.locallink.agency    | Company | Serwaa Retail Ltd; company dashboard; **Employers → Jobs** |

---

## Where to see offerings

- **Marketplace → Farmers & Florists:** Log in as any user (or stay logged out) and open **Marketplace**. Abena’s produce (tomatoes, plantain, garden eggs, okro) appears there.
- **Marketplace → Services:** Switch to the **Services** tab. Kofi’s catering and Afia’s cleaning/laundry services appear; you can click **Book** to pre-fill a job.
- **Employers / Jobs:** Go to **Services → Employers** (or your app's jobs entry). The jobs board shows Serwaa Retail Ltd's open roles. Ama Serwaa manages them from her company dashboard.
- **Profiles:** Demo users have a cover photo and bio. Visit `/u/<user-id>` (e.g. from marketplace cards or search) to see full profiles and services/products.

Re-running the script is **idempotent**: it removes existing demo users (by email) and re-creates them, including products, artisan services, company slug, and job posts. Run again to reset demo data and fix images.

---

## Product images still not showing?

1. **Re-seed on the server** so products get the correct image URLs in the DB (required after any change to seed image URLs):
   ```bash
   cd ~/LocalLink
   docker compose -f docker-compose.selfhost.yml run --rm api node scripts/seed-demo-users.js
   ```
2. **Deploy the latest frontend** so the browser uses the image proxy for Unsplash and loads Wikimedia images directly. Then hard refresh (Cmd+Shift+R) or use an incognito window.
3. **Check the Network tab**: for **Okro, Garden eggs, Plantain** the request goes directly to `upload.wikimedia.org` (no proxy). For **Tomatoes** it goes to `/api/news/image?src=...`. If any show red/failed, note the status code and URL.
