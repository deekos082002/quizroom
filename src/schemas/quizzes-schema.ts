/**
 * Quizzes: one row per game room. The host is the row owner (hostId).
 */

import type { CollectionSchema } from 'deepspace/schema'

export const quizzesSchema: CollectionSchema = {
  name: 'quizzes',
  uniqueOn: ['code'],
  ownerField: 'hostId',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 6 },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'hostId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['lobby', 'playing', 'finished'] },
      default: 'lobby',
    },
    { name: 'currentIndex', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'notesFileKey', storage: 'text', interpretation: 'plain' },
    { name: 'notesFileName', storage: 'text', interpretation: 'plain' },
    { name: 'questionCount', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: {
      read: true,
      create: true,
      update: 'own',
      delete: 'own',
      writableFields: ['title', 'status', 'currentIndex', 'notesFileKey', 'notesFileName'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
