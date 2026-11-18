/**
 * /quiz: create a room or join one by code.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { Button, Input, useToast } from '@/components/ui'
import { useJoinQuiz } from '@/lib/use-join-quiz'

// No O/0/I/1 so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_ATTEMPTS = 5

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

interface QuizFields {
  code: string
  title?: string
  status: string
  currentIndex: number
  questionCount: number
}

export default function QuizHomePage() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { createConfirmed, ready } = useMutations<QuizFields>('quizzes')
  const [creating, setCreating] = useState(false)
  const { records: quizzes } = useQuery<QuizFields>('quizzes')
  const { join, ready: joinReady } = useJoinQuiz()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      let lastError: unknown
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const id = await createConfirmed({
            code: generateCode(),
            status: 'lobby',
            currentIndex: 0,
            questionCount: 0,
          })
          navigate(`/quiz/${id}`)
          return
        } catch (e) {
          // A duplicate code is rejected by uniqueOn: try a fresh code.
          lastError = e
        }
      }
      error('Could not create room', lastError instanceof Error ? lastError.message : undefined)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    const normalized = code.trim().toUpperCase()
    const quiz = quizzes.find((q) => q.data.code === normalized)
    if (!quiz) {
      setNotFound(true)
      return
    }
    setJoining(true)
    try {
      await join(quiz.recordId)
      navigate(`/quiz/${quiz.recordId}`)
    } catch (e) {
      error('Could not join room', e instanceof Error ? e.message : undefined)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-12 text-4xl font-bold tracking-tight">Quiz</h1>
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Host a game</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Create a room and share its code with your players.
          </p>
          <Button onClick={handleCreate} disabled={!ready} loading={creating}>
            Create room
          </Button>
        </section>
        <section className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Join a game</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the code from your host.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleJoin()
            }}
            className="flex gap-3"
          >
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setNotFound(false)
              }}
              placeholder="ABC123"
              maxLength={CODE_LENGTH}
              autoComplete="off"
              className="font-mono uppercase tracking-widest"
              data-testid="join-code-input"
            />
            <Button type="submit" disabled={!joinReady || !code.trim()} loading={joining}>
              Join
            </Button>
          </form>
          {notFound && (
            <p className="mt-3 text-sm text-destructive">No room found for that code.</p>
          )}
        </section>
      </div>
    </div>
  )
}
