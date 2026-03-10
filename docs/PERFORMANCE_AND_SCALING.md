# Performance & scaling

When the site feels slow, it’s worth narrowing down **where** the time goes before assuming you need a bigger server. Often the same server is fine after a few optimisations.

## Where does the time go?

1. **Time to First Byte (TTFB)** – server/API response time. If this is high, the bottleneck is backend or server CPU/DB.
2. **Download** – size of HTML, JS, CSS, images. Improved by compression (gzip/brotli), caching, and smaller bundles.
3. **Parse/execute** – browser running JavaScript. Improved by code-splitting (you already use lazy routes) and avoiding huge chunks on first load.

## Try these first (no new server)

- **Enable gzip (or brotli) in nginx** – see `deploy/nginx/frontend.conf`. Compressing JS/CSS often cuts transfer size by 70%+.
- **Confirm long-lived cache for `/assets/`** – hashed assets can be cached for a year; your config already does this.
- **Heavy routes** – Economist reader loads a large chunk (~430 KB) + PDF worker (~1 MB) + the PDF file. That’s expected only when someone opens the Economist. Other pages load smaller chunks.
- **API slowness** – if the app feels slow after the first paint (e.g. lists, dashboards), measure API response times (e.g. Network tab, or add `Date` headers and compare). Optimise DB queries or add indexes before scaling the server.
- **Static assets** – Economist PDFs in `frontend/public/` are served by nginx. If they’re large, consider serving them from a CDN or object storage later.

## When a bigger server actually helps

- **CPU** – build (Docker) or many concurrent requests maxing the CPU.
- **RAM** – Node (API) or Postgres using a lot of memory; swap or OOM.
- **Concurrent users** – many simultaneous users; need more workers or a larger instance.

## Quick checks

- **Browser**: DevTools → Network → reload. Look at “Waiting (TTFB)” vs “Content Download” and sizes. Check if `index.html` and main JS are gzipped (Content-Encoding: gzip).
- **Server**: SSH in and run `htop` or `top` during a deploy or under load; check `docker stats` for API/DB memory.

## Summary

- First improve **transfer size** (gzip) and **caching** (already set for `/assets/`).
- If slowness is **after** the page shell (e.g. lists/dashboards), focus on **API/DB**.
- Consider a **bigger server** when you see high CPU/RAM or need more concurrency, not only because “page load feels slow.”
