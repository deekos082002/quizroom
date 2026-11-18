/**
 * Answers: one per player per question. uniqueOn + update:false = answer once.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const answersSchema: CollectionSchema = {
  name: 'answers',
  uniqueOn: ['questionId', 'playerId'],
  ownerField: 'playerId',
  columns: [
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'questionId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'choiceIndex', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'playerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: {
      read: true,
      create: true,
      update: false,
      delete: false,
      writableFields: ['quizId', 'questionId', 'choiceIndex'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
