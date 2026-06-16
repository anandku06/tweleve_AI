import { boolean, json, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const voiceCategoryEnum = pgEnum('voice_category', ['premade', 'cloned', 'custom'])

export const voiceGenderEnum = pgEnum('voice_gender', ['male', 'female', 'neutral'])

// The "voices" table is used to store information about the voices that users create or clone. It includes details such as the voice's name, description, category, gender, and the user who created it. This table is essential for managing the different voices available in the application and associating them with their respective creators.
export const voices = pgTable('voices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: voiceCategoryEnum('category').notNull().default('premade'),
  language: varchar('language', { length: 10 }).notNull().default('en'),
  gender: voiceGenderEnum('gender').notNull().default('neutral'),
  accent: varchar('accent', { length: 100 }),
  previewUrl: varchar('preview_url', { length: 1024 }),
  isPublic: boolean('is_public').notNull().default(false),
  metadata: json('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
