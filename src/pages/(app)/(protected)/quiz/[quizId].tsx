/**
 * /quiz/:quizId: the room. Step 1 only shows the join code and status.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'

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
        )}
      </div>
    </div>
  )
}
