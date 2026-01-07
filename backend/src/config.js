import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().optional().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional().default('dev_secret_change_me'),

  // Comma-separated origins for CORS in production, e.g. "https://locallink.app,https://www.locallink.app"
  CORS_ORIGINS: z.string().optional().default(''),

  // Payment webhooks
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),

  // Admin bootstrap
  ADMIN_BOOTSTRAP_SECRET: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)

export function corsOrigins() {
  const raw = env.CORS_ORIGINS.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}


