### EC2 + Domain + HTTPS (locallink.agency) — Production setup

This guide assumes:
- You have an EC2 instance (public IPv4: `18.130.159.10`)
- You deploy with `docker-compose.selfhost.yml`
- You want **HTTPS** via **Let’s Encrypt** with **Caddy** (recommended for simplest reliable TLS)

## 1) DNS: point `locallink.agency` to your EC2 IP

At your DNS provider for `locallink.agency` (registrar / Route53 / Cloudflare):
- Create an **A record**:
  - **Host/Name**: `@`
  - **Value**: `18.130.159.10`
  - **TTL**: default
- Create an **A record**:
  - **Host/Name**: `www`
  - **Value**: `18.130.159.10`

Wait for DNS to propagate (usually minutes, sometimes longer).

## 2) AWS Security Group inbound rules

Allow:
- **22** (SSH) from **your IP**
- **80** (HTTP) from **0.0.0.0/0**
- **443** (HTTPS) from **0.0.0.0/0**

## 3) SSH into the instance (macOS)

Key path: **~/Downloads/LocalLink.pem**

This instance uses **Amazon Linux** — use **ec2-user**:

```bash
chmod 400 ~/Downloads/LocalLink.pem
ssh -i ~/Downloads/LocalLink.pem ec2-user@18.130.159.10
```

If you use an Ubuntu AMI instead, use `ubuntu@18.130.159.10`.

**Redeploy from your Mac (no need to stay SSH’d):** from the repo root, run `./scripts/redeploy-ssh.sh`. It uses `~/Downloads/LocalLink.pem` and pulls + rebuilds on the server. Push to `main` first.

## 4) Install Docker + Compose plugin

### Ubuntu
```bash
sudo apt update -y
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

## 5) Deploy LocalLink containers

Clone the repo (so future redeploys can use `git pull`):

```bash
git clone <YOUR_REPO_URL> LocalLink
cd LocalLink
git checkout main
docker compose -f docker-compose.selfhost.yml up -d --build
```

If the app directory already exists but **is not a git repo** (you get “fatal: not a git repository” when running `redeploy-ssh.sh`), see **scripts/setup-server-git.sh** to replace it with a fresh clone.

Important: the `gateway` container binds to `127.0.0.1:8080`, not public port 80, because Caddy will own 80/443.

Quick health check:

```bash
curl -s http://127.0.0.1:8080/api/health
```

## 6) Install Caddy (TLS) on the host

### Ubuntu
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update -y
sudo apt install -y caddy
```

Copy the repo `Caddyfile` into place:

```bash
sudo mkdir -p /etc/caddy
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl enable caddy
```

## 7) Verify

From your laptop:
- Open `https://locallink.agency`
- Open `https://locallink.agency/api/health` (should return `{ ok: true }`)

## 8) Production secrets (required for migrate and API)

The API and migrate script require real secrets in production. On the server:

```bash
cd /home/ec2-user/LocalLink
cp .env.selfhost.example .env
# Edit .env and set strong values. Generate with:
#   openssl rand -hex 32
nano .env   # set JWT_SECRET=... and ADMIN_BOOTSTRAP_SECRET=...
```

Then run migrations (if not already done) and restart the API:

```bash
docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate
docker compose -f docker-compose.selfhost.yml up -d
```

Docker Compose reads `.env` from this directory and passes the values into the containers.

## Notes
- For production media, move uploads to **S3** (recommended).


