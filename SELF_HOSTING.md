## LocalLink self-hosting (Full control)

This runs everything on your own server:
- Postgres
- Node/Express API
- React frontend (served by nginx)
- A gateway nginx reverse proxy that routes:
  - `/` → frontend
  - `/api/*` → backend

### 1) VPS prerequisites (Ubuntu recommended)
- Docker + Docker Compose plugin installed
- Ports **80** and (later) **443** open on the firewall

### 2) Deploy
On your VPS:

```bash
git clone https://github.com/quantumfinancegroupltd-commits/Local-Link.git
cd Local-Link

# IMPORTANT: change secrets before starting (and do NOT rsync this file from your laptop after!)
# Your prod docker-compose.selfhost.yml contains real secrets. Keep it server-only.

docker compose -f docker-compose.selfhost.yml up -d --build
```

Verify:
- `http://<server-ip>/` loads the site
- `http://<server-ip>/api/health` returns `{ "ok": true }`

Tip (recommended): when deploying from a laptop using rsync, always exclude `docker-compose.selfhost.yml`
so you don’t overwrite prod secrets and crash the API.

### 3) Create the first admin user (once)
Set `ADMIN_BOOTSTRAP_SECRET` in compose, then call:

```bash
curl -X POST http://<server-ip>/api/bootstrap/admin \
  -H 'Content-Type: application/json' \
  -d '{"secret":"<ADMIN_BOOTSTRAP_SECRET>","name":"Admin","email":"admin@locallink.app","password":"StrongPassword123!"}'
```

### 4) Add HTTPS (when ready)
Once you connect your domain, put a TLS terminator in front:
- Easiest: **Caddy** (automatic Let’s Encrypt)
- Or nginx + certbot

When you’re ready, I can generate a Caddyfile for:
- `app.<domain>` (frontend)
- `api.<domain>` (optional, or keep `/api`)

### 5) Backups (recommended before real usage)
On your VPS (inside `~/LocalLink`):

```bash
chmod +x ./scripts/backup_db.sh ./scripts/restore_db.sh
./scripts/backup_db.sh
ls -la ./backups
```

**Cron (daily at 02:30 UTC)**:

```bash
crontab -e
```

Add:

```cron
30 2 * * * cd ~/LocalLink && ./scripts/backup_db.sh >> ~/LocalLink/backups/backup.log 2>&1
```

Restore (dangerous):

```bash
./scripts/restore_db.sh ./backups/locallink-db-<stamp>.sql.gz
```


