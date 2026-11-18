/**
 * The current question during play. Players get 4 buttons that lock after
 * their one answer; the host sees the question read-only plus "X/Y answered".
 * correctIndex is deliberately not a prop: it is never shown during play.
 */

import { useState } from 'react'
import { useToast } from '@/components/ui'
import { ActionError, callAction } from '@/lib/call-action'

interface Props {
  questionId: string
  number: number
  total: number
  prompt: string
  choices: string[]
  isHost: boolean
  canAnswer: boolean
  myChoice: number | null
  answeredCount: number
  playerCount: number
}

export function QuizQuestion({
  questionId,
  number,
  total,
  prompt,
  choices,
  isHost,
  canAnswer,
  myChoice,
  answeredCount,
  playerCount,
}: Props) {
  const { error } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const locked = myChoice !== null || submitting

  async function answer(choiceIndex: number) {
    if (locked) return
    setSubmitting(true)
    try {
      // The server checks game state, current question and membership;
      // playerId is bound to the caller server-side.
      await callAction('submitAnswer', { questionId, choiceIndex })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (e instanceof ActionError && e.code === 'already_answered') {
        error('Already answered', 'You can answer each question once')
      } else {
        error('Could not submit answer', msg || undefined)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6" data-testid="question-card">
      <p className="text-sm text-muted-foreground">
        Question {number} of {total}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{prompt}</h2>
      <ul className="mt-4 space-y-2">
        {choices.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              data-testid={`choice-${i}`}
              disabled={isHost || !canAnswer || locked}
              onClick={() => answer(i)}
              className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                myChoice === i
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border enabled:hover:bg-muted disabled:opacity-60'
              }`}
            >
              {String.fromCharCode(65 + i)}. {c}
            </button>
          </li>
        ))}
      </ul>
      {isHost ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="answered-count">
          {answeredCount}/{playerCount} answered
        </p>
      ) : !canAnswer ? (
        <p className="mt-4 text-sm text-muted-foreground">Join the room to answer.</p>
      ) : myChoice !== null ? (
        <p className="mt-4 text-sm text-muted-foreground">Answer locked in. Waiting for the host...</p>
      ) : null}
    </section>
  )
}
