import { apiKeys, getDb } from '@twelve/db'
import { FastifyInstance } from 'fastify'
import { success, z } from 'zod'
import { generateAPIKey, hashToken } from '../lib/crypto'
import { and, desc, eq } from 'drizzle-orm'

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required!').max(255),
  expiresAt: z.coerce.date().optional(),
})

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate) // added auth on all routes

  // POST /api-keys
  app.post('/', async (request, reply) => {
    const result = createKeySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.issues },
      })
    }

    const { name, expiresAt } = result.data
    const db = getDb()

    const { key, prefix } = generateAPIKey()
    const keyHash = hashToken(key)

    const [created] = await db
      .insert(apiKeys)
      .values({
        userId: request.user.sub,
        name,
        prefix,
        keyHash,
        expiresAt: expiresAt ?? null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })

    // return the full key JUST ONCE -> it can't be retrieved later
    return reply.status(201).send({
      success: true,
      data: { ...created, key },
    })
  })

  // GET /api-keys -> List all API keys for the user
  app.get('/', async (request, reply) => {
    const db = getDb()
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, request.user.sub))
      .orderBy(desc(apiKeys.createdAt))

    return reply.status(200).send({
      success: true,
      data: { keys },
    })
  })

  // DELETE /api-keys/:id - Revoke an API key
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = getDb()

    const [deleted] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, request.user.sub)))
      .returning({ id: apiKeys.id })

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API Key not found!' },
      })
    }

    return reply.status(200).send({
      success: true,
      data: { message: 'API Key revoked!' },
    })
  })
}
