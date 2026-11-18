/**
 * Join a quiz room: creates a `players` row for the current user unless one
 * already exists for that quiz. Safe to call twice (no duplicate rows).
 */

import { useCallback } from 'react'
import { useMutations, useQuery, useUser } from 'deepspace'

export interface PlayerFields {
  quizId: string
  playerId: string
  displayName: string
}

export function useJoinQuiz() {
  const { user } = useUser()
  const { records: players } = useQuery<PlayerFields>('players')
  const { createConfirmed, ready } = useMutations<PlayerFields>('players')

  const join = useCallback(
    async (quizId: string) => {
      if (!user) throw new Error('Not signed in')
      const already = players.some((p) => p.data.quizId === quizId && p.data.playerId === user.id)
      if (already) return
      try {
        // playerId is bound to the caller server-side.
        await createConfirmed({
          quizId,
          displayName: (user.name || 'Player').slice(0, 40),
        } as PlayerFields)
      } catch (e) {
        // uniqueOn rejected a racing duplicate: already joined, which is fine.
        const msg = e instanceof Error ? e.message.toLowerCase() : ''
        if (!msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('exist')) {
          throw e
        }
      }
    },
    [user, players, createConfirmed],
  )

  return { join, ready: ready && !!user }
}
