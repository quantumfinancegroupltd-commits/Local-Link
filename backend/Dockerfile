FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts

EXPOSE 4000

# For single-instance self-hosting, running migrations on boot is acceptable.
# For multi-replica deployments, run migrations as a separate one-off job.
CMD ["sh","-c","node src/db/migrate.js && node src/server.js"]


