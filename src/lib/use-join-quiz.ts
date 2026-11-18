/**
 * Join a quiz room via the joinQuiz server action, which creates the
 * `players` row (status gate, server-set display name). Safe to call twice:
 * the action is idempotent and this skips the call if already joined.
 */

import { useCallback } from 'react'
import { useQuery, useUser } from 'deepspace'
import { callAction } from '@/lib/call-action'

export interface PlayerFields {
  quizId: string
  playerId: string
  displayName: string
}

export function useJoinQuiz() {
  const { user } = useUser()
  const { records: players } = useQuery<PlayerFields>('players')

  const join = useCallback(
    async (quizId: string) => {
      if (!user) throw new Error('Not signed in')
      const already = players.some((p) => p.data.quizId === quizId && p.data.playerId === user.id)
      if (already) return
      await callAction('joinQuiz', { quizId })
    },
    [user, players],
  )

  return { join, ready: !!user }
}
