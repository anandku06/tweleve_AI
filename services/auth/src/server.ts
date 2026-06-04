import dotenv from 'dotenv'

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH?.trim(),
  debug: true,
})

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { jwtPlugin } from './plugins/jwt'
import { authRoutes } from './routes/auth'

const PORT = Number(process.env.AUTH_SERVICE_PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // plugins
  await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' })
  await app.register(jwtPlugin)

  // health-check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'auth',
  }))

  // routes
  await app.register(authRoutes, { prefix: '/auth' })

  await app.listen({ port: PORT, host: HOST })
}

main().catch((e) => {
  console.log('Failed to start auth service:', e)
  process.exit(1)
})
