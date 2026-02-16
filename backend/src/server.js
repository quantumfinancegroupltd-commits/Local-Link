import 'dotenv/config'
import { createApp } from './app.js'
import { env } from './config.js'
import { pool } from './db/pool.js'

const port = Number(env.PORT || 4000)
const app = createApp()

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`LocalLink API listening on http://localhost:${port}`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  // eslint-disable-next-line no-console
  console.log(`Shutting down (${signal})...`)

  await new Promise((resolve) => {
    server.close(() => resolve())
    // Force close after 10s
    setTimeout(resolve, 10_000).unref?.()
  })
  try {
    await pool.end()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error closing Postgres pool', e)
  }
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
