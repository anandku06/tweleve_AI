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
      expiresIn: process.env.JWT_EXPIRES_IN || '15m', // default to 1 hour if not set
    },
  })

  // this is a custom authentication function that will be used as a preHandler for protected routes. It verifies the JWT token and checks if the user exists in the database.
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ message: 'Authorization header is missing' })
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

export const jwtPlugin = fp(jwt, {
  name: 'jwt',
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
