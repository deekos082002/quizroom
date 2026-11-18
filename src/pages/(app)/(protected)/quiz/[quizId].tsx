/**
 * /quiz/:quizId: the room. Shows the join code, status and the lobby of players
 * with live online dots.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePresenceRoom, useQuery, useUser } from 'deepspace'
import { Button, useToast } from '@/components/ui'
import { useJoinQuiz, type PlayerFields } from '@/lib/use-join-quiz'

interface QuizFields {
  code: string
  title?: string
  hostId: string
  status: string
}

export default function QuizRoomPage() {
  const { quizId } = useParams<{ quizId: string }>()
  // Members can read every quiz; pick this one out by record id.
  const { records, status } = useQuery<QuizFields>('quizzes')
  const quiz = records.find((r) => r.recordId === quizId)

  const { user } = useUser()
  const { error } = useToast()
  const { join, ready: joinReady } = useJoinQuiz()
  const { records: allPlayers } = useQuery<PlayerFields>('players', {
    where: { quizId: quizId ?? '' },
  })
  const players = allPlayers.filter((p) => p.data.quizId === quizId)
  // Presence peers exclude yourself, so add own id to the online set.
  const { peers } = usePresenceRoom(`quiz:${quizId}`)
  const onlineIds = new Set(peers.map((p) => p.userId))
  if (user) onlineIds.add(user.id)

  const isHost = !!user && quiz?.data.hostId === user.id
  const isPlayer = !!user && players.some((p) => p.data.playerId === user.id)
  const [joining, setJoining] = useState(false)

  async function handleJoin() {
    if (!quizId) return
    setJoining(true)
    try {
      await join(quizId)
    } catch (e) {
      error('Could not join room', e instanceof Error ? e.message : undefined)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        {status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading room...</p>
        ) : !quiz ? (
          <section className="rounded-lg border border-border bg-card p-6">
            <h1 className="text-lg font-semibold">Room not found</h1>
            <Link
              to="/quiz"
              className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to Quiz
            </Link>
          </section>
        ) : (
          <>
          <section className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Join code</p>
            <p
              data-testid="room-code"
              className="mt-2 font-mono text-5xl font-bold tracking-[0.3em]"
            >
              {quiz.data.code}
            </p>
            <p className="mt-6 text-sm text-muted-foreground">Status: {quiz.data.status}</p>
          </section>
          <section className="mt-6 rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Players ({players.length})</h2>
              {!isHost && !isPlayer && (
                <Button onClick={handleJoin} disabled={!joinReady} loading={joining}>
                  Join
                </Button>
              )}
            </div>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for players...</p>
            ) : (
              <ul className="space-y-2" data-testid="player-list">
                {players.map((p) => {
                  const online = onlineIds.has(p.data.playerId)
                  return (
                    <li key={p.recordId} className="flex items-center gap-3 text-sm">
                      <span
                        aria-label={online ? 'online' : 'offline'}
                        className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                      />
                      {p.data.displayName}
                      {user && p.data.playerId === user.id ? ' (you)' : ''}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  )
}
