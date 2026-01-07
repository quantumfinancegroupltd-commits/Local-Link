# LocalLink Frontend (React + Tailwind)

## Local dev

### Configure backend URL (optional)

By default the frontend calls APIs at `/api/*`. If your backend runs on a different origin, set:

- `VITE_API_BASE_URL`, e.g. `http://localhost:4000/api`

## Deploy (Recommended): Vercel
1) Import `frontend/` into Vercel (or import the whole repo and set Root Directory to `frontend`)
2) Add an env var:
   - `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com/api`
3) Deploy

### Run

```bash
npm install
npm run dev
```

## Notes

- Role-based routes: buyer / artisan / farmer / admin
- Tailwind is configured in `tailwind.config.js` and `src/index.css`
