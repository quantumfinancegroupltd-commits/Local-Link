import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().optional().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional().default('dev_secret_change_me'),

  // Postgres pool tuning (production reliability)
  PG_POOL_MAX: z.coerce.number().optional().default(10),
  PG_POOL_IDLE_TIMEOUT_MS: z.coerce.number().optional().default(30_000),
  PG_POOL_CONN_TIMEOUT_MS: z.coerce.number().optional().default(5_000),
  PG_STATEMENT_TIMEOUT_MS: z.coerce.number().optional().default(30_000),

  // Comma-separated origins for CORS in production, e.g. "https://locallink.app,https://www.locallink.app"
  CORS_ORIGINS: z.string().optional().default(''),

  // Payment webhooks
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),

  // Public app URL (used for payment callback redirects), e.g. https://app.locallinkgh.com
  APP_BASE_URL: z.string().optional(),

  // Email (optional). If not set, password reset emails won't send in production.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  SMTP_FROM: z.string().optional(), // e.g. "LocalLink <no-reply@locallink.agency>"

  // Password resets
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().optional().default(30),

  // Platform fees (as decimals), e.g. 0.08 for 8%
  PLATFORM_FEE_PCT_JOB: z.coerce.number().optional().default(0.08),
  PLATFORM_FEE_PCT_ORDER: z.coerce.number().optional().default(0.05),
  // Delivery cut (driver earnings = fee * (1 - pct))
  PLATFORM_FEE_PCT_DELIVERY: z.coerce.number().optional().default(0.1667),

  // Delivery fee formula (transparent, no surge yet)
  DELIVERY_BASE_FEE: z.coerce.number().optional().default(10),
  DELIVERY_RATE_PER_KM: z.coerce.number().optional().default(4),
  DELIVERY_SPEED_KMH: z.coerce.number().optional().default(25),

  // Auto-release timers (in hours). Keep provider integrations separate; these are internal workflow rules.
  AUTO_RELEASE_JOB_HOURS: z.coerce.number().optional().default(72),
  AUTO_CONFIRM_DELIVERY_HOURS: z.coerce.number().optional().default(48),
  // Workforce scheduling
  SHIFT_NO_SHOW_GRACE_HOURS: z.coerce.number().optional().default(4),
  SHIFT_COMPLETE_GRACE_HOURS: z.coerce.number().optional().default(2),
  SHIFT_SERIES_AUTO_GENERATE_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  SHIFT_SERIES_AUTO_GENERATE_INTERVAL_MIN: z.coerce.number().optional().default(15),
  SHIFT_COVERAGE_AUTO_FILL_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  SHIFT_COVERAGE_AUTO_FILL_INTERVAL_MIN: z.coerce.number().optional().default(10),
  COMPANY_OPS_ALERTS_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  COMPANY_OPS_ALERTS_INTERVAL_MIN: z.coerce.number().optional().default(10),
  COMPANY_OPS_WEEKLY_DIGEST_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),

  // Background workers
  SCHEDULERS_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  WEBHOOK_QUEUE_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  WEBHOOK_QUEUE_MAX_ATTEMPTS: z.coerce.number().optional().default(10),

  // Admin bootstrap
  ADMIN_BOOTSTRAP_SECRET: z.string().optional(),

  // S3 / R2 storage (when STORAGE_DRIVER=s3)
  STORAGE_DRIVER: z.string().optional().default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional().default('auto'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => String(v).toLowerCase() === 'true' || String(v) === '1'),
  S3_PUBLIC_URL: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_PUBLIC_HASH: z.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),

  // Transactional messaging (Termii / Twilio)
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)

// Production safety checks
if (env.NODE_ENV === 'production') {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production')
  }
  const badSecrets = new Set(['dev_secret_change_me', 'change_me_in_prod', '<set-strong-secret>', '<set-bootstrap-secret>'])
  if (!env.JWT_SECRET || badSecrets.has(String(env.JWT_SECRET).trim())) {
    throw new Error('JWT_SECRET must be set to a strong, non-placeholder value in production')
  }
  if (!env.ADMIN_BOOTSTRAP_SECRET || badSecrets.has(String(env.ADMIN_BOOTSTRAP_SECRET).trim())) {
    throw new Error('ADMIN_BOOTSTRAP_SECRET must be set to a strong, non-placeholder value in production')
  }
  if (!env.CORS_ORIGINS || !env.CORS_ORIGINS.trim()) {
    throw new Error('CORS_ORIGINS must be set in production (comma-separated list of allowed origins)')
  }
}

export function corsOrigins() {
  const raw = env.CORS_ORIGINS.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}


