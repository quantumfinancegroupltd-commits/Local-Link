# Rollback procedure

How to revert a deployment when something goes wrong.

## Code rollback

1. **Identify the last known good commit** (e.g. from Git history or your release tag).
2. **Revert the deployment** using your normal deploy process, but from the previous commit:
   - **rsync deploy** (`deploy/deploy_mac.sh`): Check out the previous commit locally, then run the deploy script so the server gets the old code.
   - **Docker / compose**: Rebuild and redeploy from the previous commit (e.g. `git checkout <previous>`, then `docker compose build && docker compose up -d`).
   - **CI/CD**: If you use automated deploys, trigger a deploy of the previous tag or commit, or re-run the workflow for that commit.
3. **Restart the API** so the old code is loaded (e.g. `docker compose restart api`, or restart the Node process).
4. **Verify**: Hit `/api/health` and run a quick smoke test or manual check.

## Database (migrations)

- **Migrations are forward-only.** There are no “down” migration scripts in this project. Once a migration has been applied, rolling it back is manual.
- **Before rolling back code that depends on a new migration:** If the new code expects new columns or tables, reverting only the code without reverting the DB can cause errors (e.g. missing column). Options:
  - **Preferred:** Roll back code to a version that still works with the *current* DB. If the last deploy only added a new migration and no code yet uses it, you can safely roll back code; the extra migration is harmless.
  - **If you must undo a migration:** Write a one-off SQL script that reverses the migration (e.g. drop the column or table), run it manually, then roll back the code. Keep a copy of that script for audit.
- **Never re-run an old migration file** that has already been applied (the migration runner tracks applied migrations); use a new “rollback” script or manual SQL if you need to undo schema changes.

## After rollback

- Check logs and error reporting (e.g. Sentry) for the period between the bad deploy and rollback.
- Fix the issue in a new branch/commit and redeploy when ready.

---

*See also: [FIX_502.md](./FIX_502.md) for 502 troubleshooting, [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) for deploy checklist.*
