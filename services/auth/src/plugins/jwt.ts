// This file is used to extend the FastifyJWT interface with our custom payload and user types.

import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { eq, or, isNull, gt } from 'drizzle-orm'
import { getDb, apiKeys, users } from '@twelve/db'
import { hashToken } from '../lib/crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// this module declaration is necessary to tell TypeScript that we are adding properties to the FastifyJWT interface
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string } // payload type is used for signing and verifying tokens
    user: { sub: string; email: string } // user type is used for the request.user object after verifying the token
  }
}

// this function is the actual plugin that will be registered with Fastify. It can be used to add any additional functionality or configuration related to JWT.
async function jwt(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }

  await app.register(fjwt, {
    secret,
    sign: {
      expiresIn: process.env.JWT_ACCESS_EXPIRE_IN || '15m', // default to 1 hour if not set
    },
  })

  // this is a custom authentication function that will be used as a preHandler for protected routes. It verifies the JWT token and checks if the user exists in the database.
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ message: 'Authorization header is missing' })
    }

    // check if this is an API key
    const token = authHeader.replace('Bearer ', '')
    if (token.startsWith('xi_')) {
      return authenticateAPIKey(token, request, reply)
    }

    try {
      await request.jwtVerify() // this will verify the token and populate request.user with the payload
    } catch (err) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid Authorization header' },
      })
    }
  })
}

async function authenticateAPIKey(key: string, request: FastifyRequest, reply: FastifyReply) {
  const db = getDb()
  const keyHash = hashToken(key)

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  })
  if (!apiKey) {
    return reply
      .status(401)
      .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key!' } })
  }

  // check expiry of the API Key
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'API Key has expired!' },
    })
  }

  // look for the user
  const user = await db.query.users.findFirst({
    where: eq(users.id, apiKey.userId),
    columns: { id: true, email: true },
  })
  if (!user) {
    return reply
      .status(404)
      .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found!' } })
  }

  // update the lastUsed (fire-and-forget -> don't slow the request)
  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKey.id))
    .then(() => {})

  // set user on request
  request.user = { sub: user.id, email: user.email }
}

export const jwtPlugin = fp(jwt, {
  name: 'jwt',
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
