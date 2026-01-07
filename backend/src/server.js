import { createApp } from './app.js'
import { env } from './config.js'

const port = Number(env.PORT || 4000)
const app = createApp()

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`LocalLink API listening on http://localhost:${port}`)
})


