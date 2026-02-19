# Use Supabase as the database (simple 3 steps)

**Goal:** Point LocalLink at Supabase so the site works without 502.

---

## Step 1 — Get your database password (once)

1. Open [Supabase](https://supabase.com) → your project.
2. Go to **Project Settings** (gear) → **Database**.
3. Under **Connection string** → **URI**, copy the string. It contains `[YOUR-PASSWORD]`.
4. If you don’t know the password, click **Reset database password**, set a new one, and remember it.

You’ll use this password in Step 2 (script) and in Step 3 (server `.env`).

---

## Step 2 — Run migrations from your Mac (once)

From your Mac, in Terminal:

```bash
cd /Users/richardholland/Desktop/LocalLink/backend
./scripts/migrate-supabase.sh
```

When prompted, enter your **Supabase database password** (the one from Step 1).  
Wait until you see something like “Migrations complete.”

---

## Step 3 — Point the server at Supabase

1. **SSH in:**
   ```bash
   ssh -i "$HOME/Downloads/ssh-key-2026-02-18 (2).key" ubuntu@140.238.93.79
   ```

2. **Edit env:**
   ```bash
   cd ~/LocalLink && nano .env
   ```
   Set one line (use your **real** password from Step 1):
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.bjrxwtvceihqykkwzxku.supabase.co:5432/postgres?sslmode=require
   ```
   Save: **Ctrl+O**, Enter. Exit: **Ctrl+X**.

3. **Restart the app:**
   ```bash
   docker compose -f docker-compose.selfhost.yml up -d --force-recreate api worker
   exit
   ```

4. Open **https://locallink.agency** and confirm the 502 is gone.

---

**Summary:** Get Supabase DB password → run `./scripts/migrate-supabase.sh` on your Mac (enter password when asked) → put the same URL in server `.env` → restart api/worker. Use the **same** password and `?sslmode=require` in the URL on the server.
