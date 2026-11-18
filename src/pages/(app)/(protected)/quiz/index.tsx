/**
 * /quiz: create a room (join-by-code arrives in Step 2).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Button, useToast } from '@/components/ui'

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
      </div>
    </div>
  )
}
