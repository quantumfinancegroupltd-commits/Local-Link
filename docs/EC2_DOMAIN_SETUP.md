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

```bash
chmod 400 ~/Downloads/LocalLink.pem
ssh -i ~/Downloads/LocalLink.pem ubuntu@18.130.159.10
```

If Ubuntu user fails, try:

```bash
ssh -i ~/Downloads/LocalLink.pem ec2-user@18.130.159.10
```

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

```bash
git clone <YOUR_REPO_URL> LocalLink
cd LocalLink
docker compose -f docker-compose.selfhost.yml up -d --build
```

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

## Notes
- Update `JWT_SECRET` and `ADMIN_BOOTSTRAP_SECRET` in `docker-compose.selfhost.yml` before real users.
- For production media, move uploads to **S3** (recommended).


