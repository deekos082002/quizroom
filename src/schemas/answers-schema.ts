/**
 * Answers: one per player per question. uniqueOn + update:false = answer once.
 * Members can't create directly: the submitAnswer action is the only writer,
 * so it can enforce game state (playing, current question, joined player).
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
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
