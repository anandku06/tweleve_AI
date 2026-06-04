import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { eq, and, gt } from 'drizzle-orm'
import { getDb, refreshTokens, users } from '@twelve/db'
import { generateRefreshToken, hashToken } from '../lib/crypto'

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters long'),
})

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

async function createRefreshToken(db: ReturnType<typeof getDb>, userId: string): Promise<string> {
  const raw = generateRefreshToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt })

  return raw
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.issues,
        },
      })
    }

    const { email, password, name } = result.data
    const db = getDb()

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A user with this email already exists',
        },
      })
    }

    const passwordHash = await argon2.hash(password)

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })

    const accessToken = app.jwt.sign({ sub: newUser.id, email: newUser.email })
    const refreshToken = await createRefreshToken(db, newUser.id)

    return reply.status(201).send({
      success: true,
      data: { newUser, accessToken, refreshToken },
    })
  })

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.issues,
        },
      })
    }

    const { email, password } = result.data
    const db = getDb()

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      })
    }

    const passwordValid = await argon2.verify(user.passwordHash, password)
    if (!passwordValid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      })
    }

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email })
    const refreshToken = await createRefreshToken(db, user.id)

    return reply.status(200).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    })
  })

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    const result = refreshTokenSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.issues,
        },
      })
    }

    const { refreshToken: rawToken } = result.data
    const db = getDb()
    const tokenHash = hashToken(rawToken)

    const tokenRecord = await db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, new Date())),
    })
    if (!tokenRecord) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        },
      })
    }

    // delete the used refresh token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id))

    // look up the user
    const user = await db.query.users.findFirst({
      where: eq(users.id, tokenRecord.userId),
      columns: { id: true, email: true }, // only select necessary fields
    })
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      })
    }

    // generate new tokens
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email })
    const newRefreshToken = await createRefreshToken(db, user.id)

    return reply.status(200).send({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    })
  })

  // GET /auth/me (protected route)
  // using the built-in authentication hook provided by fastify-jwt: onRequest: [app.authenticate], passing the authenticate function as a hook to protect this route. This means that any request to /auth/me will first go through the authentication process, and if the JWT is valid, the request will proceed to the handler. If the JWT is missing or invalid, the request will be rejected with an appropriate error response.
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const db = getDb()

    const user = await db.query.users.findFirst({
      where: eq(users.id, request.user.sub),
      columns: { id: true, email: true, name: true, createdAt: true, updatedAt: true }, // only select necessary fields
    })
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      })
    }

    return reply.status(200).send({
      success: true,
      data: user,
    })
  })
}
