# 502 Bad Gateway

A **502** usually means the reverse proxy (Caddy → gateway nginx) could not get a valid response from the app (web or api containers).

## 1. Run database migrations (most common after fresh deploy)

On a **fresh clone** or **new database**, the API needs migrations before it can serve requests. SSH in and run:

```bash
ssh -i ~/Downloads/LocalLink.pem ec2-user@18.130.159.10
cd /home/ec2-user/LocalLink
docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate
exit
```

Then reload https://locallink.agency/

## 2. Check containers and logs

On the server:

```bash
cd /home/ec2-user/LocalLink
docker compose -f docker-compose.selfhost.yml ps -a
docker compose -f docker-compose.selfhost.yml logs api --tail 50
docker compose -f docker-compose.selfhost.yml logs gateway --tail 20
```

- All of `db`, `api`, `worker`, `web`, `gateway` should show **Up**.
- If **api** is **Exit** or restarting, check its logs (often DB connection or missing migrations).
- **gateway** logs may show "upstream timed out" or "connection refused" to `api` or `web`.

## 3. Check the gateway from the host

On the server:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/health
```

- **200** = gateway and backends are OK; the issue may be Caddy or DNS.
- **502** = gateway is up but api/web are not responding (migrations, crash, or not started).

## 4. Restart after migrations

If you just ran migrations, restart the API so it picks up the schema:

```bash
docker compose -f docker-compose.selfhost.yml restart api
```

Then try the site again.
