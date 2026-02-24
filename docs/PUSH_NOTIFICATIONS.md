# Push Notifications (Web Push)

Browser push notifications are implemented so users get notified when they’re not on the site (e.g. new message, order update, job application).

## How it works

1. **Backend** stores push subscriptions per user (`push_subscriptions` table). When `notify()` creates an in-app notification, it also sends a web push to all of that user’s subscriptions (best-effort; failures don’t block the in-app notification).
2. **Frontend** Notifications page has an “Enable push notifications” button. On click: request permission → get VAPID key from API → subscribe via service worker → POST subscription to `POST /api/notifications/push-subscribe`.
3. **Service worker** (`frontend/public/sw.js`) listens for `push` events and shows a notification; on click it focuses/opens the app at the notification URL.

## Server setup

1. Generate VAPID keys (once):
   ```bash
   cd backend && npx web-push generate-vapid-keys
   ```
2. Add to backend env (e.g. `.env` or production env):
   ```bash
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```
3. Run migration: `npm run migrate` (creates `push_subscriptions` table).
4. Deploy frontend so `/sw.js` is served at the root (Vite/CRA static files include `public/sw.js`).

If VAPID keys are not set, the “Enable push notifications” button will get a 503 from `/api/notifications/vapid-public-key` and show “Push is not configured on the server.” In-app notifications continue to work.

## Optional next steps

- **SMS/Email**: For users without the browser open, add Termii/Twilio (or similar) and send SMS/email for high-value events (e.g. quote accepted, order shipped). See `EXTERNAL_INTEGRATIONS_ROADMAP.md` § 1.4.
