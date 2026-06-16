import dotenv from 'dotenv'
dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH?.trim(),
  debug: true,
})

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { jwtPlugin } from './plugins/jwt'
import { voiceRoutes } from './routes/voice'
import { libraryRoutes } from './routes/library'
import { configDotenv } from 'dotenv'

const PORT = Number(process.env.VOICE_SERVICE_PORT) || 3002
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' })
  await app.register(jwtPlugin)

  app.get('/health', async () => ({ status: 'ok', service: 'voice' }))

  await app.register(voiceRoutes, { prefix: '/voices' })
  await app.register(libraryRoutes, { prefix: '/library' })

  await app.listen({ port: PORT, host: HOST })
}

main().catch((err) => {
  console.error('Failed to start voice service!', err)
  process.exit(1)
})
