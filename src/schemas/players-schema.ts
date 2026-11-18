/**
 * Players: who joined which quiz. One row per (quiz, player).
 */

import type { CollectionSchema } from 'deepspace/schema'

export const playersSchema: CollectionSchema = {
  name: 'players',
  uniqueOn: ['quizId', 'playerId'],
  ownerField: 'playerId',
  columns: [
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'playerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain', maxLength: 40 },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: {
      read: true,
      create: true,
      update: false,
      delete: 'own',
      writableFields: ['quizId', 'displayName'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
