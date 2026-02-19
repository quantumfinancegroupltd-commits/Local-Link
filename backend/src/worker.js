import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { env } = await import('./config.js')
const { startSchedulers } = await import('./services/schedulers.js')

// Dedicated background worker process for schedulers + webhook retry queue.
// Keep this separate from the API so deploys/restarts don’t disrupt background processing.

// eslint-disable-next-line no-console
console.log(
  `LocalLink WORKER starting (node_env=${env.NODE_ENV}) schedulers=${env.SCHEDULERS_ENABLED} webhook_queue=${env.WEBHOOK_QUEUE_ENABLED}`,
)

startSchedulers()


