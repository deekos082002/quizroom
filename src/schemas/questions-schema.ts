/**
 * Questions: 10 per quiz, written only by the generateQuestions server action.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const questionsSchema: CollectionSchema = {
  name: 'questions',
  ownerField: 'hostId',
  columns: [
    { name: 'quizId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'index', storage: 'number', interpretation: 'plain', required: true },
    { name: 'prompt', storage: 'text', interpretation: 'plain', required: true, maxLength: 500 },
    { name: 'choices', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'correctIndex', storage: 'number', interpretation: 'plain', required: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
