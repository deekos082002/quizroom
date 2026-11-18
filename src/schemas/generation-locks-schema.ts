/**
 * Generation locks: one row per quiz while generateQuestions is running.
 * uniqueOn makes the create atomic, so two concurrent runs can't both proceed.
 * Server-only: no client role can read or write it.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const generationLocksSchema: CollectionSchema = {
  name: 'generation_locks',
  uniqueOn: ['quizId'],
  columns: [
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'startedAt', storage: 'number', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
