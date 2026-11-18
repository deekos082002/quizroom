/**
 * /quiz/:quizId: the room. Shows the join code, status and the lobby of players
 * with live online dots.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getAuthToken,
  useMutations,
  usePresenceRoom,
  useQuery,
  useR2Files,
  useUser,
} from 'deepspace'
import { Button, useToast } from '@/components/ui'
import { QuizQuestion } from '@/components/QuizQuestion'
import { Leaderboard } from '@/components/Leaderboard'
import { Results } from '@/components/Results'
import { rankPlayers } from '@/lib/scoring'
import { useJoinQuiz, type PlayerFields } from '@/lib/use-join-quiz'

interface QuizFields {
  code: string
  title?: string
  hostId: string
  status: string
  notesFileKey?: string
  notesFileName?: string
  questionCount?: number
  currentIndex?: number
}

interface QuestionFields {
  quizId: string
  index: number
  prompt: string
  choices: string[]
  correctIndex: number
}

interface AnswerRow {
  quizId: string
  questionId: string
  choiceIndex: number
  playerId: string
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

  // Notes + question generation (host only).
  const { upload, isUploading } = useR2Files()
  const { putConfirmed: putQuiz } = useMutations<QuizFields>('quizzes')
  const [generating, setGenerating] = useState(false)
  // Only the host reads the question list; players just see the count.
  const { records: allQuestions } = useQuery<QuestionFields>('questions', {
    where: { quizId: quizId ?? '' },
  })
  const sortedQuestions = allQuestions
    .filter((q) => q.data.quizId === quizId)
    .sort((a, b) => a.data.index - b.data.index)
  const questions = isHost ? sortedQuestions : []
  const questionCount = quiz?.data.questionCount ?? 0

  // Game flow: current question and answers.
  const { records: allAnswers } = useQuery<AnswerRow>('answers', {
    where: { quizId: quizId ?? '' },
  })
  const answers = allAnswers.filter((a) => a.data.quizId === quizId)
  const currentIndex = quiz?.data.currentIndex ?? 0
  const current = sortedQuestions.find((q) => q.data.index === currentIndex)
  const currentAnswers = current ? answers.filter((a) => a.data.questionId === current.recordId) : []
  const myAnswer = user ? currentAnswers.find((a) => a.data.playerId === user.id) : undefined
  const isLastQuestion = currentIndex >= questionCount - 1
  // Scores are derived from answers vs correctIndex. While playing, only
  // questions the host has moved past count, so the open question isn't leaked.
  const hostId = quiz?.data.hostId ?? ''
  const scoreQuestions = sortedQuestions.map((q) => ({
    id: q.recordId,
    index: q.data.index,
    correctIndex: q.data.correctIndex,
  }))
  const scoreAnswers = answers.map((a) => a.data)
  const finished = quiz?.data.status === 'finished'
  const ranking = rankPlayers(
    players.map((p) => p.data),
    scoreQuestions,
    scoreAnswers,
    hostId,
    finished ? Infinity : currentIndex,
  )
  const answeredIds = new Set(currentAnswers.map((a) => a.data.playerId))
  const myPicks = new Map(
    answers.filter((a) => user && a.data.playerId === user.id).map((a) => [a.data.questionId, a.data.choiceIndex]),
  )
  const [advancing, setAdvancing] = useState(false)

  // Host-only: the server's update:'own' rule rejects anyone else.
  async function setGameState(patch: Partial<QuizFields> & { currentIndex?: number }) {
    if (!quizId) return
    setAdvancing(true)
    try {
      await putQuiz(quizId, patch)
    } catch (err) {
      error('Could not update game', err instanceof Error ? err.message : undefined)
    } finally {
      setAdvancing(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !quizId) return
    if (!/\.(txt|pdf)$/i.test(file.name)) {
      error('Unsupported file', 'Upload a .txt or .pdf file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      error('File too large', 'Notes must be under 5 MB')
      return
    }
    try {
      const result = await upload(file, file.name)
      if (!result.success || !result.key) throw new Error(result.error ?? 'Upload failed')
      await putQuiz(quizId, { notesFileKey: result.key, notesFileName: file.name })
    } catch (err) {
      error('Could not upload notes', err instanceof Error ? err.message : undefined)
    }
  }

  async function handleGenerate() {
    if (!quizId) return
    setGenerating(true)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/actions/generateQuestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quizId }),
      })
      const body = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !body.success) throw new Error(body.error ?? `Request failed (${res.status})`)
    } catch (err) {
      error('Could not generate questions', err instanceof Error ? err.message : undefined)
    } finally {
      setGenerating(false)
    }
  }

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
          {isHost && quiz.data.status === 'lobby' && (
            <section className="mt-6 rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Notes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {quiz.data.notesFileName ? `Uploaded: ${quiz.data.notesFileName}` : 'Upload a .txt or .pdf file.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".txt,.pdf"
                  data-testid="notes-input"
                  onChange={handleUpload}
                  disabled={isUploading}
                  className="text-sm"
                />
                <Button
                  onClick={handleGenerate}
                  disabled={!quiz.data.notesFileKey || isUploading}
                  loading={generating}
                >
                  {questionCount > 0 ? 'Regenerate questions' : 'Generate questions'}
                </Button>
              </div>
            </section>
          )}
          {isHost && quiz.data.status === 'lobby' && (
            <Button
              className="mt-6"
              onClick={() => setGameState({ status: 'playing', currentIndex: 0 })}
              disabled={questionCount === 0}
              loading={advancing}
            >
              Start game
            </Button>
          )}
          {quiz.data.status === 'playing' && (
            <>
              {current ? (
                <QuizQuestion
                  key={current.recordId}
                  quizId={quizId ?? ''}
                  questionId={current.recordId}
                  number={currentIndex + 1}
                  total={questionCount}
                  prompt={current.data.prompt}
                  choices={current.data.choices}
                  isHost={isHost}
                  canAnswer={isPlayer}
                  myChoice={myAnswer ? myAnswer.data.choiceIndex : null}
                  answeredCount={currentAnswers.length}
                  playerCount={players.length}
                />
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">Loading question...</p>
              )}
              {isHost && (
                <Button
                  className="mt-6"
                  onClick={() =>
                    isLastQuestion
                      ? setGameState({ status: 'finished' })
                      : setGameState({ currentIndex: currentIndex + 1 })
                  }
                  loading={advancing}
                >
                  {isLastQuestion ? 'Finish game' : 'Next question'}
                </Button>
              )}
            </>
          )}
          {quiz.data.status === 'playing' && (
            <Leaderboard ranking={ranking} answeredIds={answeredIds} meId={user?.id} />
          )}
          {finished && (
            <Results
              ranking={ranking}
              questions={sortedQuestions.map((q) => ({
                id: q.recordId,
                index: q.data.index,
                prompt: q.data.prompt,
                choices: q.data.choices,
                correctIndex: q.data.correctIndex,
              }))}
              myPicks={myPicks}
              meId={user?.id}
              showMine={!isHost}
            />
          )}
          {quiz.data.status === 'lobby' && questionCount > 0 && (
            <section className="mt-6 rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold" data-testid="questions-ready">
                {questionCount} questions ready
              </h2>
              {isHost && (
                <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm" data-testid="question-list">
                  {questions.map((q) => (
                    <li key={q.recordId}>
                      {q.data.prompt}
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {q.data.choices.map((c, i) => (
                          <li key={i} className={i === q.data.correctIndex ? 'font-medium text-foreground' : ''}>
                            {String.fromCharCode(65 + i)}. {c}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          </>
        )}
      </div>
    </div>
  )
}
