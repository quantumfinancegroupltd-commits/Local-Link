import 'dotenv/config'
import { env } from './config.js'
import { startSchedulers } from './services/schedulers.js'

// Dedicated background worker process for schedulers + webhook retry queue.
// Keep this separate from the API so deploys/restarts don’t disrupt background processing.

// eslint-disable-next-line no-console
console.log(
  `LocalLink WORKER starting (node_env=${env.NODE_ENV}) schedulers=${env.SCHEDULERS_ENABLED} webhook_queue=${env.WEBHOOK_QUEUE_ENABLED}`,
)

startSchedulers()


